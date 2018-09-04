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

        execa.shellSync('git init');
        execa.shellSync('git config user.email "you@example.com"');
        execa.shellSync('git config user.name "Your Name"');
        execa.shellSync('git commit --allow-empty -m "init" --no-gpg-sign');
    });

    afterEach(function () {
        process.env.GITLAB_AUTH_TOKEN = this.oldToken;
        process.chdir(this.cwd);
    });

    describe('release flow: Patch increment', () => {

        beforeEach(function () {
            process.env.CI_COMMIT_REF_NAME = 'release/1.0.0';

            writePackageJsonFile('1.0.0');
        });

        afterEach(function () {
            process.env.CI_COMMIT_REF_NAME = '';
        });

        it('should increment PATCH for any changes', () => {
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
            execa.shellSync('git commit --allow-empty -m "fix(index): patch change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore: patch change" --no-gpg-sign');

            return expect(gitlabRelease({ gitHost, allowPush }, { logger }))
                .to.be.fulfilled
                .and.to.eventually.equal('1.0.1')
                .then(() => scope.isDone());
        });

        it('should increment PATCH for CHORE changes', () => {
            const scope = nock(`https://gitlab.project.com`)
                .get(`/api/v4/version`).reply(200)
                .post(`/api/v4/projects/project%2Fgitlab-release/repository/tags`, {
                    message: `Release 1.0.1`,
                    release_description: /.*/,
                    ref: /.*/,
                    tag_name: `1.0.1`,
                }).reply(201);

            execa.shellSync('git tag 1.0.0');
            execa.shellSync('git commit --allow-empty -m "chore(index): major change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore(index): patch change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore: patch change" --no-gpg-sign');

            return expect(gitlabRelease({ gitHost, allowPush }, { logger }))
                .to.be.fulfilled
                .and.to.eventually.equal('1.0.1')
                .then(() => scope.isDone());
        });
    });

    describe('release flow: FourDigits', () => {

        beforeEach(function () {
            process.env.CI_COMMIT_REF_NAME = 'release/1.3.1';

            writePackageJsonFile('1.3.1-build.0');
        });

        afterEach(function () {
            process.env.CI_COMMIT_REF_NAME = '';
        });

        it('should increment PATCH for CHORE changes, from 1.3.1-build.0', () => {
            const scope = nock(`https://gitlab.project.com`)
                .get(`/api/v4/version`).reply(200)
                .post(`/api/v4/projects/project%2Fgitlab-release/repository/tags`, {
                    message: `Release 1.3.1-build.1`,
                    release_description: /.*/,
                    ref: /.*/,
                    tag_name: `1.3.1-build.1`,
                }).reply(201);

            execa.shellSync('git tag 1.3.0-build.10');
            execa.shellSync('git commit --allow-empty -m "chore(index): major change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore(index): patch change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore: patch change" --no-gpg-sign');

            return expect(gitlabRelease({ buildType: 'fourDigits', gitHost, allowPush }, { logger }))
                .to.be.fulfilled
                .and.to.eventually.equal('1.3.1-build.1')
                .then(() => scope.isDone());
        });

    });

    describe('feature flow', () => {

        beforeEach(function () {

            writePackageJsonFile('1.3.1');
        });

        afterEach(function () {
            process.env.CI_COMMIT_REF_NAME = '';
        });

        it('should increment PATCH for Feature changes', () => {
            process.env.CI_COMMIT_REF_NAME = 'feature/23456_big-feature';

            execa.shellSync('git tag 1.3.1');
            execa.shellSync('git commit --allow-empty -m "chore(index): major change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore(index): patch change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore: patch change" --no-gpg-sign');

            return expect(gitlabRelease({ gitHost, allowPush }, { logger }))
                .to.be.fulfilled
                .and.to.eventually.equal('1.3.1-big-feature.0')
        });

        it('check feature naming with incorrect underscore', () => {
            process.env.CI_COMMIT_REF_NAME = 'feature/23456_big_feature';

            execa.shellSync('git tag 1.3.1');
            execa.shellSync('git commit --allow-empty -m "chore(index): major change 23456_big_feature" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore(index): patch change" --no-gpg-sign');
            execa.shellSync('git commit --allow-empty -m "chore: patch change 23456_big_feature" --no-gpg-sign');

            return expect(gitlabRelease({ gitHost, allowPush }, { logger }))
                .to.be.fulfilled
                .and.eventually.be.rejected.then((error) => {
                    expect(`Error: Invalid version: "1.3.1-big_feature.0"`).to.equal(error.actual);
                });
        });
    });
});

// Empty `package.json` file for our publish pipeline to write a version into.
function writePackageJsonFile(version) {
    fs.writeFileSync(`package.json`, `{
                    "name": "test",
                    "version": "${version}",
                    "repository": {
                        "type": "git",
                        "url": "https://${gitHost}"
                    }
                }`);

    fs.writeFileSync(`package-lock.json`, `{
                    "name": "test",
                    "version": "${version}",
                    "lockfileVersion": 1,
                    "requires": true
                }`);
}
