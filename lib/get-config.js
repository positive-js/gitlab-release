const cosmiconfig = require('cosmiconfig');

const CONFIG_NAME = 'release';
const CONFIG_FILES = [
    `.${CONFIG_NAME}rc`,
    `.${CONFIG_NAME}rc.js`
];

module.exports = (context) => {
    const {cwd, env, logger} = context;

    const config = cosmiconfig(CONFIG_NAME, {searchPlaces: CONFIG_FILES}).searchSync(cwd) || {};

    logger.log(config);
    return config;
};
