const execa = require('execa');


const gitCommitAndPush =
    {
        title: 'Git "commit" and "push"',
        task: (ctx, task) => new Promise((resolve, reject) => {

            execa.shellSync(`git commit -m '[ci skip] bump version to: ${ctx.config.pkg.version}'`);
            execa.shellSync(`git push https://${process.env.BUILDER_USER}:${process.env.BUILDER_USER_PASSWORD}@${ctx.config.gitHost} HEAD:${process.env.CI_COMMIT_REF_NAME}`);

            resolve();
        })
    };

const gitAddTag =
    {
        title: 'Git add "tag"',
        task: (ctx, task) => new Promise((resolve, reject) => {

            execa.shellSync(`git tag ${ctx.config.pkg.version}`);
            task.output = `added tag ${ctx.config.pkg.version}`;

            resolve();
        })
    };

const gitConfig =
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
    };

module.exports = {
    gitCommitAndPush,
    gitConfig,
    gitAddTag
};
