const readPkgUp = require('read-pkg-up');


function readPkg() {
    const {pkg} = readPkgUp.sync();

    if (!pkg) {
        throw new Error(`No package.json found. Make sure you're in the correct project.`);
    }

    return pkg;
};

function getMonthString(month) {
    switch (month) {
        case 0:
            return 'января';
        case 1:
            return 'февраля';
        case 2:
            return 'марта';
        case 3:
            return 'апреля';
        case 4:
            return 'мая';
        case 5:
            return 'июня';
        case 6:
            return 'июля';
        case 7:
            return 'августа';
        case 8:
            return 'сентября';
        case 9:
            return 'октября';
        case 10:
            return 'ноября';
        case 11:
            return 'декабря';
    }
}

function getSubject(config, isSubjectMail = false) {
    const date = new Date();
    const dateString = `${date.getDate()} ${getMonthString(date.getMonth())}`;

    return `${isSubjectMail ? 'Новая версия ': ''}${config.pkg.name} ${config.pkg.version} (${dateString})`;
}

module.exports = {
    readPkg,
    getSubject
};
