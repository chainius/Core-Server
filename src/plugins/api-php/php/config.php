<?php

    global $_CONFIGS;
    $_CONFIGS = array();
    
    function json_file($path)
    {
        $content = @file_get_contents($path);
        $content = (array) @json_decode($content);
        return $content;
    }

    function is_local()
    {
        return (IS_LOCAL === 'true' || IS_LOCAL === true);
    }

    function getConfig($name)
    {
        global $_CONFIGS;
        
        if(isset($_CONFIGS[$name]))
        {
            return $_CONFIGS[$name];
        }
        
        $npath = CONFIG_PATH.$name.'.json';
        $path  = $npath;

        if(!is_local())
        {
            $path2 = CONFIG_PATH.$name.'-online.json';
            if(is_file($path2))
            {
                $path = $path2;
            }
        }
        
        if($path != $npath)
        {
            if(!file_exists($npath))
            {
                $_CONFIGS[$name] = array();
                return $_CONFIGS[$name];
            }
        }
        
        $content = json_file($path);
   
        if(!$content)
        {
            $_CONFIGS[$name] = array();
            return $_CONFIGS[$name];   
        }
        
        $_CONFIGS[$name] = (array) $content;
        return $_CONFIGS[$name];
    }
