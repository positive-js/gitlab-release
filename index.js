const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const semver = require('semver');
const execa = require('execa');

const Listr = require('listr');
const VerboseRenderer = require('listr-verbose-renderer');
const Bluebird = require('bluebird');
const latestSemverTag = Bluebird.promisify(require('git-latest-semver-tag'));
const recommendedBump = Bluebird.promisify(require('conventional-recommended-bump'));
const streamToArray = require('stream-to-array');
const rawCommitsStream = require('git-raw-commits');

const releaseNotesGenerator = require('./lib/releaseNotesGenerator');
const util = require('./lib/util');


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
        currentVersion: pkg.version
    };

    const branchName = process.env.CI_COMMIT_REF_NAME || 'release/';

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
                ifFeature: true
            }
        }
    };

    config.buildType = (packageOpts.buildType) ? buildTypes[packageOpts.buildType] : buildTypes[branchType[0]];

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
        {
            title: 'Increment package.json version',
            task: (ctx, task) => new Promise((resolve, reject) => {

                let nextVersion;

                if (config.buildType().isRelease) {

                    nextVersion = semver.inc(config.pkg.version, 'patch');
                } else if (config.buildType().ifFeature) {

                    const featureName = branchType[1].split(/_(.+)/)[1];

                    nextVersion = semver.inc(config.pkg.version, 'prerelease', featureName);
                } else if (config.buildType().isFourDigits) {

                    nextVersion = semver.inc(config.pkg.version, 'prerelease', 'build');
                } else {
                    task.output = 'incPkgVersion: unsupported buildType';
                    reject();
                }

                config.pkg.version = config.nextVersion = nextVersion;

                new Promise((resolve, reject) => {
                    const out = fs.createWriteStream(path.join(process.cwd(), `package.json`))
                        .on('finish', resolve)
                        .on('error', reject);

                    out.write(JSON.stringify(config.pkg, null, '    '));
                    out.end();
                })
                    .then(() => {
                        task.output = `Next version: ${config.pkg.version}`;

                        resolve();
                    })
                    .catch(() => {
                        reject();
                    })
            })
        },
        {
            title: 'Increment package-lock.json version',
            task: (ctx, task) => new Promise((resolve, reject) => {

                const pkgLock = JSON.parse(fs.readFileSync(path.join(process.cwd(), `package-lock.json`)));
                pkgLock.version = config.pkg.version;

                const out = fs.createWriteStream(path.join(process.cwd(), `package-lock.json`))
                    .on('finish', resolve)
                    .on('error', reject);

                out.write(JSON.stringify(pkgLock, null, '    '));
                out.end();
            })
        }
    ]);

    tasks.add([
        {
            title: 'Git config',
            task: (ctx, task) => new Promise((resolve, reject) => {

                execa.shellSync(`git config --global user.email "${process.env.BUILDER_USER}@ptsecurity.com"`);
                task.output = 'added User Email';

                execa.shellSync(`git config --global user.name "${process.env.BUILDER_USER}"`);
                task.output = 'added User Name';

                execa.shellSync(`git config --global push.default simple`);
                task.output = 'added "push.default simple"';

                resolve();
            })
        }
    ]);

    if (config.buildType().isRelease) {
        tasks.add([
            {
                title: 'Generate Changelog for Release',
                task: (ctx, task) => new Promise((resolve, reject) => {
                    releaseNotesGenerator(config)
                        .then(() => {
                            resolve();
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

    return tasks.run();
}
