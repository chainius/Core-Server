<?php

    function api($category, $name, $vars = null)
    {
        //-----------------------------------------------------------
        //Check Action credentials
        $path  = ACTIONS_PATH.$category;
        $cpath = $path.'/config.json';
        $config = json_file($cpath);


        global $active_db;
        $old_db = $active_db;

        if(isset($config['database']))
        {
            use_db($config['database']);
        }
        else
        {
            use_db('mysql');
        }

        if(!check_connection())
        {
            global $_RESULT, $active_db;
            $active_db = $old_db;
            return $_RESULT;
        }

        //-----------------------------------------------------------
        //CREATE POST
        if($vars == null)
        {
            $vars = $_POST;
        }

        if(connected())
        {
            $vars['auth_id'] = auth_id();
        }

        //-----------------------------------------------------------
        //Test SQL Action
        $path .= '/'.$name;
        $spath = $path.'.sql';

        if(is_file($spath))
        {
            $sql = file_get_contents($spath);
            $res = api_query($sql, $vars);

            global $active_db;
            $active_db = $old_db;
            return $res;
        }

        //-----------------------------------------------------------
        //Verify php file exists

        $ppath = $path.'.php';

        if(!is_file($ppath))
        {
            global $active_db;
            $active_db = $old_db;

            //api_header("HTTP/1.0 404 Not Found");
            return array("error" => "action not found");
        }

        //-----------------------------------------------------------
        //Run PHP action

        global $_RESULT;
        $_RESULT = array();
        $old_post = $_POST;
        $_POST = $vars;

        include($ppath);

        global $_RESULT;
        $_POST = $old_post;

        global $active_db;
        $active_db = $old_db;
        return $_RESULT;
    }

    function api_result($res)
    {
        global $_RESULT;

        if(!is_array($res) && !is_object($res))
        {
            $res = array("result" => $res);
        }

        $_RESULT = $res;
    }

    function api_error($res)
    {
        global $_RESULT;
        $_RESULT = array("error" => $res);
    }

    function api_query($sql, $vars = null, $db_type = null)
    {
        if(!check_connection())
        {
            global $_RESULT;
            return $_RESULT;
        }

        if($vars == null)
        {
            $vars = $_POST;
        }

        $query = query($sql, $vars, $db_type);
        $result = array();

        while(($row = $query->fetchObject()))
        {
            $result[] = $row;
        }

        $db = db($db_type);
        if(count($result) == 0 && db_has_error())
        {
            global $_RESULT;
            return $_RESULT;
        }
        else if(count($result) == 0)
        {
            if(($id = $db->insert_id()))
            {
                $result["id"] = $id;
            }
        }

        api_result($result);
        return $result;
    }