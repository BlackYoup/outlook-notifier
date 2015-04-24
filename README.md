## Outlook notifier for Firefox

This module allows you to have a quick check on your [Outlook.com](https://outlook.com) email number.

![Addon IMG](https://addons.cdn.mozilla.net/user-media/previews/full/140/140338.png)

### Features

+ Auto fetch
+ Set how often the module will fetch for new mails
+ Instant updates when you're changing the counter (i.e reading a mail)
+ Customizable settings
+ Notifications

### Build

You need [CFX](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Getting_started) to build this extension

```
  cd ./app/
  cfx xpi outlook-notifier.xpi

```
Extension will be created under ./app/outlook-notifier.xpi

### Development and continous build

You need [Node.js](https://nodejs.org/), [CFX](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Getting_started) and [AutoInstaller](https://addons.mozilla.org/addon/autoinstaller/) to have a continuous build of the addon

```
  git clone --recursive git@github.com:BlackYoup/outlook-notifier.git
  npm install
  grunt

```

To specify a Dev environment (see ``conf/dev.js``), export the ENVIRONMENT variable with DEV as a value : ``ENVIRONMENT=DEV grunt``

### TODO

+ Multi languages (at least English and French)
+ Don't only check inbox but also other folders if specified (when your mails are automaticaly filtered to a specific folder)
+ Read / answer mails without going to [Outlook.com](https://outlook.com)
+ and a bunch of other features

### Contributors

+ [Arnaud Lefebvre](https://github.com/LefebvreArnaud)

Feel free to contribute. It's my first module on Firefox so any advices or critics are welcomed
