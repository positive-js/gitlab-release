const semver = require('semver');
const path = require('path');
const fs = require('fs-extra');


const incPkgLockJson =
    {
        title: 'Increment package-lock.json version',
        task: (ctx, task) => new Promise((resolve, reject) => {

            const pkgLock = JSON.parse(fs.readFileSync(path.join(process.cwd(), `package-lock.json`)));
            pkgLock.version = ctx.config.pkg.version;

            const out = fs.createWriteStream(path.join(process.cwd(), `package-lock.json`))
                .on('finish', resolve)
                .on('error', reject);

            out.write(JSON.stringify(pkgLock, null, '    '));
            out.end();
        })
    };

const incPkgJson =
    {
        title: 'Increment package.json version',
        task: (ctx, task) => new Promise((resolve, reject) => {

            let nextVersion;

            if (ctx.config.buildType().isRelease) {

                nextVersion = semver.inc(ctx.config.pkg.version, 'patch');
            } else if (ctx.config.buildType().isFeature) {

                const featureName = ctx.config.branchType[1].split(/_(.+)/)[1];
                const versionNameReg = /^(\d+)\.(\d+)\.(\d+)(?:-(.+)\.(\d)+)?/;

                const version = ctx.config.pkg.version.match(versionNameReg);

                if (version[4]) {
                    version[5]++;
                    nextVersion = `${ctx.config.pkg.version}-${featureName}.${version[5]}`;
                } else {
                    nextVersion = `${ctx.config.pkg.version}-${featureName}.0`;
                }
            } else if (ctx.config.buildType().isFourDigits) {

                nextVersion = semver.inc(ctx.config.pkg.version, 'prerelease', 'build');
            } else {

                task.output = 'incPkgVersion: unsupported buildType';
                reject();
            }

            ctx.config.pkg.version = ctx.config.nextVersion = nextVersion;

            new Promise((resolve, reject) => {
                const out = fs.createWriteStream(path.join(process.cwd(), `package.json`))
                    .on('finish', resolve)
                    .on('error', reject);

                out.write(JSON.stringify(ctx.config.pkg, null, '    '));
                out.end();
            })
                .then(() => {
                    task.output = `Next version: ${ctx.config.pkg.version}`;

                    resolve();
                })
                .catch(() => {
                    reject();
                })
        })
    };

module.exports = {
    incPkgJson,
    incPkgLockJson
};
