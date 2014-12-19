var preferences = require('sdk/simple-prefs'),
  prefs = preferences.prefs;

function Preferences(){

  this.get = function(name){
    return prefs[name];
  };

  this.set = function(name, value){
    prefs[name] = value;
  };

  this.on = function(name, cb){
    preferences.on(name, cb);
  };
}
module.exports = new Preferences();
