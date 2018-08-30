const semver = require('semver');
const path = require('path');
const fs = require('fs');


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
            } else if (config.buildType().ifFeature) {

                const featureName = branchType[1].split(/_(.+)/)[1];

                nextVersion = semver.inc(ctx.config.pkg.version, 'prerelease', featureName);
            } else if (config.buildType().isFourDigits) {

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
    };

module.exports = {
    incPkgJson,
    incPkgLockJson
};
