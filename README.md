<p align="center">
<img width="100" src="./wiki/img/logo/logo-128.png" >
<br>
<b>Core Server</b>
</p>

## Quick Installation

To install Core Server and start a new project, run the following commands:

```
npm install -g core-server
core-server --init
```

----

# Core Server

**Description**:
Core Server helps teams set a standard project structure and workings for all sort of Node projects.

We developed Core Server to provide a standard and global project structure for our web platforms developed in-house. We were loosing to much time figuring out a project structure for each seperate project. We open sourced as it may help other developers facing the same problems.

**Technology stack**:
Core Server is based on Node's v10 architecture and has a tight integration with VueJS.

**Status**:
Currently used by multiple launched projects!
This open-source version is currently not yet production ready.
We recently added a CLI and modular plugin system before open sourcing, which still needs testing.
We started versioning since open sourcing the project. [CHANGELOG](CHANGELOG.md).

**Projects using Core Server**
- [SkyHark](https://www.skyhark.com/)
- [FameBroker](https://www.famebroker.com/)
- 3 Projects under an NDA

----

## Usage

**Project folder structure**:

Using this project means that a certain folder structure is desired.
This can be achieved by running:
``` core-server init ```

The folder structure looks like this:
```
Project root
│
└─── api
│    └─── ...
│
└─── components
│    └─── ...
│
└─── resources
│    └─── styles
│         └─── ...
│    └─── fonts
│         └─── ...
│    └─── img
│         └─── ...
│    └─── lib
│         └─── init.js
│
└─── config
│    └─── servers.json
│    └─── servers-online.json
│    └─── public-api.json
│    └─── plugins.json
│
└─── package.json
```
To learn more about project setup please take a look at our [Wiki](wiki).

Open up a terminal and make your way to your project root folder an run following command:
``` core-server [--port XXXX] ```

The default port is 8080.
Your project will be accessible on http://localhost:8080/

----

## Getting involved

**Devlopment**:

Detailed instructions to develop and build Core Server from source can be found in our [DEVELOPMENT](DEVELOPMENT.md) document.
We hope to see your great changes as contributions to this project.

**Contributions**:

We hope to provide a working project that fits many needs.
In return we hope to improve Core Server with the help of the community.

Contributing can be done in many  ways.Instructions on _how_ to contribute scan be found in our [CONTRIBUTING](CONTRIBUTING.md) guide.

----

## Getting help

If you have questions, concerns, bug reports, etc, please file an issue in this repository's Issue Tracker.

## Known issues to solve & Todo list

- [ ] We currently do not have unit tests in the repository. (Help would be appreciated)
- [ ] Our [DEVELOPMENT](DEVELOPMENT) guide still needs to be written.
- [ ] The Wiki is currently empty but is currently being worked on.

----

## License

[MIT](LICENSE)

Copyright (c) 2016-present, Sacha Vandamme

----