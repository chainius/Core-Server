const siteManager    = plugins.getEntry('web-server/MasterServer').siteManager;
const ApiEnvironment = plugins.require('api/ApiEnvironment');

module.exports = new ApiEnvironment({
    siteManager:    siteManager,
    session:        { auth_id: 0 },
    sessionObject:  null,
    cookie:         {},
    post:           {},
    $get:           {},
    file:           {},
    client_ip:      ''
});