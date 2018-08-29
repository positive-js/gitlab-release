const readPkgUp = require('read-pkg-up');


module.exports.readPkg = () => {
    const {pkg} = readPkgUp.sync();

    if (!pkg) {
        throw new Error(`No package.json found. Make sure you're in the correct project.`);
    }

    return pkg;
};
