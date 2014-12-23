function Mail(mail){
  var self = this;

  this.id = mail.id;
  this.rawSubject = null;
  this.subject = null;
  this.state = 'unread';

  this.parseMailSubject = function(){
    return mail.querySelector('.Sb').textContent.trim();
  };

  this.trimSubject = function(subject){
    if(subject.length > 30){
      subject = subject.substr(0, 26) + '...';
    }
    return subject;
  };

  this.init = function(){
    this.rawSubject = this.parseMailSubject();
    this.subject = this.trimSubject(this.rawSubject);
    return this;
  };
}

module.exports = Mail;
