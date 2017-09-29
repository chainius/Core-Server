<?php

    ini_set('display_errors',1);
    ini_set('display_startup_errors',1);
    error_reporting(E_ALL);

    $_POST    = (array)json_decode(getenv("post"));
    $_SESSION = (array)json_decode(getenv("session"));
    $_COOKIE  = (array)json_decode(getenv("cookie"));

    define('ACTIONS_PATH', getenv('actions_path'));
    define('IS_LOCAL', getenv('is_local'));
    define('CONFIG_PATH', ACTIONS_PATH.'/../config/');
    define('SUBCORE_PATH', ACTIONS_PATH.'/../core/php/');
    
    date_default_timezone_set('Europe/Brussels');

    
    //--------------------------------------------------------------------------------

    //include core
    @phpcore;

    $arr = (array) glob(SUBCORE_PATH.'*.php');
    foreach ($arr as $filename) {
        include_once($filename);
        $GLOBALS += get_defined_vars();
    }

    //--------------------------------------------------------------------------------
    //Execute requested api
    $request_path = substr(getenv('api_exec'), strlen(ACTIONS_PATH), -4);
    $index        = strpos($request_path, '/');
    if($index < 1)
        $index = strpos($request_path, '\\');

    $category     = substr($request_path, 0, $index);
    $name         = substr($request_path, $index+1);

    $result       = api($category, $name, $_POST);

    global $mailSends;
    if(count($mailSends) > 0)
        $result['__core__[mails]__'] = $mailSends;

    print json_encode($result);