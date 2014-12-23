var tabs = require('sdk/tabs');

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

  if(current.major > saved.major || current.minor > saved.minor || current.bugFix > saved.bugFix){
    isUpdated = true;
  }

  return isUpdated ? 'updated' : 'not_updated';
};

var showChangeLog = function(version){
  var currentversionAnchor = '#v' + version.replace(/\./g, '');
  tabs.open('https://blackyoup.github.io/outlook-notifier/' + currentversionAnchor);
};

module.exports = {
  splitVersion: splitVersion,
  checkVersions: checkVersions,
  showChangeLog: showChangeLog
};
