#!/usr/bin/env node
const _ = require('lodash');
const execa = require('execa');

const Listr = require('listr');
const gitlabReleaser = require('semantic-release-gitlab-releaser');
const VerboseRenderer = require('listr-verbose-renderer');
const Bluebird = require('bluebird');
const latestSemverTag = Bluebird.promisify(require('git-latest-semver-tag'));
const recommendedBump = Bluebird.promisify(require('conventional-recommended-bump'));
const streamToArray = require('stream-to-array');
const rawCommitsStream = require('git-raw-commits');

const releaseNotesGenerator = require('./lib/releaseNotesGenerator');
const getConfig = require('./lib/get-config');
const util = require('./lib/util');
const gitTask = require('./lib/tasks/git-task');
const pkgTask = require('./lib/tasks/pkg-task');


module.exports = gitlabRelease;

function gitlabRelease(packageOpts, { logger }) {

    const pkg = util.readPkg();

    const config = {
        pkg,
        options: {
            scmToken: process.env.GITLAB_AUTH_TOKEN,
            insecureApi: process.env.GITLAB_INSECURE_API === `true`,
            preset: 'angular'
        },
        gitHost: packageOpts.gitHost,
        currentVersion: pkg.version
    };

    const branchName = process.env.CI_COMMIT_REF_NAME;

    if (!branchName) {
        logger.error(`branchName is not define`);
        return 1;
    }

    const branchType = branchName.split('/');

    if (!branchType[0]) {
        logger.error(`We can release only 'release' or 'feature' branch. Sry ^^`);
        return 1;
    }

    const buildTypes = {
        'release': function () {
            return {
                isRelease: true
            }
        },
        'fourDigits': function () {
            return {
                isFourDigits: true
            }
        },
        'feature': function () {
            return {
                isFeature: true
            }
        }
    };

    config.buildType = (packageOpts.buildType) ? buildTypes[packageOpts.buildType] : buildTypes[branchType[0]];
    config.branchType = branchType;

    const plugins = getConfig({ cwd: process.cwd(), logger });

    logger.log('Start Tasks');

    const tasks = new Listr([], { renderer: VerboseRenderer });

    tasks.add([
        {
            title: 'Get Commits From Latest Semver Tag',
            task: (ctx, task) => new Promise((resolve, reject) => {

                latestSemverTag()
                    .then(latestTag => streamToArray(rawCommitsStream({from: latestTag})))
                    .then(_.partial(_.map, _, value => value.toString()))
                    .then((commits) => {
                        if (commits.length === 0) {
                            task.output = `no commits to release so skipping the other release steps`;
                            reject();
                            return;
                        }

                        task.output = commits;
                        ctx.commits = commits;
                        resolve();
                    })
                    .catch(err => {
                        reject(err);
                    })

            })
        },
        {
            title: 'Get Recommended Bump',
            task: (ctx, task) => new Promise((resolve, reject) => {

                recommendedBump({ ignoreReverted: false, preset: config.options.preset })
                    .then((recommendation) => {

                        if (recommendation.releaseType === undefined) {
                            task.output = `no recommended release so skipping the other release steps`;
                            reject();
                        }

                        task.output = `recommended version bump is - ${JSON.stringify(recommendation)}`;
                        resolve();
                    })
                    .catch(err => {
                        reject(err);
                    })
            })
        },
        pkgTask.incPkgJson,
        pkgTask.incPkgLockJson
    ]);

    tasks.add([
        gitTask.gitConfig
    ]);

    if (config.buildType().isRelease) {
        tasks.add([
            {
                title: 'Generate Changelog for Release',
                task: (ctx, task) => new Promise((resolve, reject) => {
                    releaseNotesGenerator(config)
                        .then(() => {
                            resolve();
                        })
                        .catch(() => {
                            reject();
                        });
                })
            },
            {
                title: 'Git "add" for Release',
                task: (ctx, task) => new Promise((resolve, reject) => {

                    execa.shellSync(`git add package.json package-lock.json CHANGELOG.md`);
                    task.output = 'added package.json & package-lock.json CHANGELOG.md';

                    resolve();
                })
            }
        ]);
    }

    if (config.buildType().isFeature) {
        tasks.add([
            {
                title: 'Git "add" for Feature',
                task: (ctx, task) => new Promise((resolve, reject) => {

                    execa.shellSync(`git add package.json package-lock.json`);
                    task.output = 'added package.json & package-lock.json';

                    resolve();
                })
            }
        ]);
    }

    if (packageOpts.allowPush) {
        tasks.add([
            gitTask.gitCommitAndPush
        ]);
    }

    tasks.add([
        gitTask.gitAddTag
    ]);

    if (config.buildType().isFeature && packageOpts.allowPush) {
        tasks.add([
            {
                title: 'Git "push --tags" for Feature',
                task: () => new Promise((resolve, reject) => {

                    execa.shellSync(`git push https://${process.env.BUILDER_USER}:${process.env.BUILDER_USER_PASSWORD}@${config.gitHost} --tags`);

                    resolve();
                })
            }
        ]);
    }

    if (plugins.config && plugins.config.buildArtifact) {
        tasks.add([
            {
                title: 'Build and Upload Artifact',
                task: (ctx, task) => new Promise((resolve, reject) => {

                    execa.shellSync(`${plugins.config.buildArtifact.cmd}`);

                    resolve();
                })
            }
        ]);
    }

    if (config.buildType().isRelease) {
        tasks.add([
            {
                title: 'Upload changelog to Gitlab Tag',
                task: (ctx, task) => new Promise((resolve, reject) => {
                    gitlabReleaser(config)
                        .then(() => {
                            resolve();
                        })
                        .catch((err) => {
                            reject(err);
                        });
                })
            }
        ]);

        if (plugins.config && plugins.config.sendEmail) {
            tasks.add([
                {
                    title: 'Send Email Notification',
                    task: (ctx, task) => new Promise((resolve, reject) => {

                        execa.shellSync(`${plugins.config.sendEmail.cmd}`);

                        resolve();
                    })
                }
            ]);
        }
    }


    return tasks.run({ config })
        .then(() => util.readPkg())
        .then(result => {
            return result.version;
        });
}
