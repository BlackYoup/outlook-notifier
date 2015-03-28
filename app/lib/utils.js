let tabs = require('sdk/tabs');

let splitVersion = function(version){
  if(!version){
    return null;
  }
  let obj = version.split('.');
  let versionObj = {
    major: parseInt(obj[0]),
    minor: parseInt(obj[1]),
    bugFix: parseInt(obj[2])
  };

  return versionObj;
};

let checkVersions = function(current, saved){
  let isUpdated = false;

  if(current.major > saved.major || current.minor > saved.minor || current.bugFix > saved.bugFix){
    isUpdated = true;
  }

  return isUpdated ? 'updated' : 'not_updated';
};

let showChangeLog = function(version){
  let currentversionAnchor = '#v' + version.replace(/\./g, '');
  tabs.open('https://blackyoup.github.io/outlook-notifier/' + currentversionAnchor);
};

module.exports = {
  splitVersion: splitVersion,
  checkVersions: checkVersions,
  showChangeLog: showChangeLog
};
