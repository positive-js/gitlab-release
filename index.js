const Listr = require('listr');

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
            console.log(`We r start publish 'release' branch!`);

            return {
                isRelease: true
            }
        },
        'fourDigits': function () {
            console.log(`We r start publish Release with 'fourDigits'!`);
            return {
                isFourDigits: true
            }
        },
        'feature': function () {
            console.log(`We r start publish 'feature' branch!`);

            return {
                ifFeature: true
            }
        }
    };

    config.buildType = (packageOpts.buildType) ? buildTypes[packageOpts.buildType] : buildTypes[branchType[0]];

    const tasks = new Listr([]);

}
