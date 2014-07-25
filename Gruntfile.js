var path = require('path');

module.exports = function(grunt){
    grunt.initConfig({
        watch: {
            files: ['lib/*.js'],
            tasks: ['shell:build', 'shell:post']
        },
        shell:{
            build:{
                command: 'cd ' + path.join(__dirname, 'bin') + ' && cfx xpi'
            },
            post:{
                command: 'wget --post-file=./bin/outlook-notifier.xpi http://127.0.0.1:8888/',
                options:{
                    callback: function(err, stdout, stderr, cb){
                        cb();
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-shell');
    grunt.registerTask('default', ['watch']);
};
