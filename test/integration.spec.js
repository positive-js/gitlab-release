const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const path = require('path');
const fs = require('fs-extra');
const mocha = require('mocha');
const tmp = require('tmp');
const nock = require('nock');
const execa = require('execa');

const gitlabRelease = require('../index');
const getLogger = require('../lib/get-logger');

chai.use(chaiAsPromised);
const expect = chai.expect;

const afterEach = mocha.afterEach;
const before = mocha.before;
const beforeEach = mocha.beforeEach;
const describe = mocha.describe;
const it = mocha.it;


const gitHost = 'gitlab.project.com/project/gitlab-release.git';
const allowPush = false;

const context = {
    cwd: process.cwd(),
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr
};

const logger = getLogger(context);

describe('gitlab-release', function () {

    this.timeout(20000);

    before(() => {
        nock.disableNetConnect();
    });

    beforeEach(function () {

        this.cwd = process.cwd();
        this.tmpDir = tmp.dirSync();

        fs.copySync(path.resolve(__dirname,'../lib/changelog.html'), `${this.tmpDir.name}/lib/changelog.html`);

        fs.copySync(path.resolve(__dirname,'../CHANGELOG.md'), `${this.tmpDir.name}/CHANGELOG.md`);

        console.log(this.tmpDir.name);

        process.chdir(this.tmpDir.name);

        this.oldToken = process.env.GITLAB_AUTH_TOKEN;
        process.env.GITLAB_AUTH_TOKEN = 'token';

        // Empty `package.json` file for our publish pipeline to write a version into.
        fs.writeFileSync(`package.json`, `{
            "name": "test",
            "version": "1.0.0",
            "repository": {
                "type": "git",
                "url": "https://${gitHost}"
            }
        }`);

        fs.writeFileSync(`package-lock.json`, `{
            "name": "test",
            "version": "1.0.0",
            "lockfileVersion": 1,
            "requires": true
        }`);

        //fs.writeFileSync(`CHANGELOG.md`, ``);

        execa.shellSync('git init');
        execa.shellSync('git config user.email "you@example.com"');
        execa.shellSync('git config user.name "Your Name"');
        execa.shellSync('git commit --allow-empty -m "init" --no-gpg-sign');
    });

    afterEach(function () {
        process.env.GITLAB_AUTH_TOKEN = this.oldToken;
        process.chdir(this.cwd);
    });

    describe('release flow - branch', () => {

        beforeEach(function () {
            process.env.CI_COMMIT_REF_NAME = 'release/1.0.0'
        });

        afterEach(function () {
            process.env.CI_COMMIT_REF_NAME = '';
        });

        it('should increment last tag with a minor for a breaking change (major-worthy)', () => {
            const scope = nock(`https://gitlab.project.com`)
                .get(`/api/v4/version`).reply(200)
                .post(`/api/v4/projects/project%2Fgitlab-release/repository/tags`, {
                    message: `Release 1.0.1`,
                    release_description: /.*/,
                    ref: /.*/,
                    tag_name: `1.0.1`,
                }).reply(201);

            execa.shellSync('git tag 1.0.0');
            execa.shellSync('git commit --allow-empty -m "feat(index): major change" --no-gpg-sign');

            return expect(gitlabRelease({ gitHost, allowPush }, { logger })).to.be.fulfilled
                .and.to.eventually.equal('1.0.1')
                .then(() => scope.isDone());
        });

    });
});
