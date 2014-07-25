var buttons = require('sdk/ui/button/action'),
    tabs = require('sdk/tabs');

module.exports = function(){
    this.button = null;

    this.createButton = function(){
        this.button = buttons.ActionButton({
            id: 'outlook-notifier',
            label: 'Open Outlook.com',
            icon: {
                '16': './outlook-16.png',
                '32': './outlook-32.png',
                '64': './outlook-64.png'
            },
            onClick: this.buttonClick
        });
    };

    this.buttonClick = function(){
        tabs.open('https://mail.live.com');
    };

    this.init = function(){
        this.createButton();
        return this;
    };
};
