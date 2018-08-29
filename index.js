const _ = require('lodash');

const Listr = require('listr');
const Bluebird = require('bluebird');
const latestSemverTag = Bluebird.promisify(require('git-latest-semver-tag'));
const streamToArray = require('stream-to-array');
const rawCommitsStream = require('git-raw-commits');

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
            logger.log(`We r start publish 'release' branch!`);

            return {
                isRelease: true
            }
        },
        'fourDigits': function () {
            logger.log(`We r start publish Release with 'fourDigits'!`);
            return {
                isFourDigits: true
            }
        },
        'feature': function () {
            logger.log(`We r start publish 'feature' branch!`);

            return {
                ifFeature: true
            }
        }
    };

    config.buildType = (packageOpts.buildType) ? buildTypes[packageOpts.buildType] : buildTypes[branchType[0]];

    const tasks = new Listr([]);

    tasks.add([
        {
            title: 'Latest Semver Tag',
            task: (ctx) => {

                return latestSemverTag()
                    .then(latestTag => {
                        return streamToArray(rawCommitsStream({from: latestTag}));
                    })
                    .then(_.partial(_.map, _, value => value.toString()))
            }
        },
        {
            title: 'Commit Messages',
            task: (ctx) => {

                return logger.log(`commit messages from last tag: %O`);
            }
        },
    ]);

    return tasks.run();
}
