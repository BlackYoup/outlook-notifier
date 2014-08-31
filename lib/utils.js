var _ = require('./vendor/underscore-1.7.0-min'),
    tabs = require('sdk/tabs');

var splitVersion = function(version){
    if(!version){
        return null;
    }
    var obj = version.split('.');
    var versionObj = {
        major: parseInt(obj[0]),
        minor: parseInt(obj[1]),
        bugFix: parseInt(obj[2])
    };

    return versionObj;
};

var checkVersions = function(current, saved){
    var isUpdated = false;
    
    if(!_.isEqual(current, saved)){
        if(current.major > saved.major || current.minor > saved.minor || current.bugFix > saved.bugFix){
            isUpdated = true;
        }
    }

    return isUpdated ? 'updated' : 'not_updated';
};

var showChangeLog = function(){
    tabs.open('https://lefebvrearnaud.github.io/outlook-notifier/#changelog');
};

module.exports = {
    splitVersion: splitVersion,
    checkVersions: checkVersions,
    showChangeLog: showChangeLog
};
