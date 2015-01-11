module.exports = function(grunt){
  var confFile = process.env.ENVIRONMENT && process.env.ENVIRONMENT === 'DEV' ? './conf/dev.js' : './conf/prod.js';

  grunt.log.write('Building for ' + (process.env.ENVIRONMENT || 'PROD') + ' environment');
  grunt.initConfig({
    watch: {
      files: ['app/lib/*.js', 'app/package.json'],
      tasks: ['exec:deleteConf', 'exec:createConfDir', 'exec:addConf', 'exec:build', 'exec:install'],
      options: {
        atBegin: true
      }
    },
    exec: {
      deleteConf: {
        cmd: 'rm ./app/lib/conf/conf.js',
        exitCode: [0, 1]
      },
      createConfDir: {
        cmd: 'mkdir ./app/lib/conf',
        exitCode: [0 ,1]
      },
      addConf: {
        cmd: 'cp ' + confFile + ' ./app/lib/conf/conf.js'
      },
      build: {
        cmd: 'cd ./app/ && /usr/bin/python2.7 /usr/bin/cfx xpi',
      },
      install: {
        cmd: 'wget --post-file=./app/outlook-notifier.xpi http://127.0.0.1:8888/',
        exitCode: [0, 8]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-exec');

  grunt.registerTask('build', ['exec:addConf', 'exec:build']);
  grunt.registerTask('default', ['watch']);
};
