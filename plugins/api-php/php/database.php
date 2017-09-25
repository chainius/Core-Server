<?php

    function db($type = null)
    {
        if($type == null)
        {
            global $active_db;

            if(!isset($active_db))
            {
                $active_db = "mysql";

            }

            $type = $active_db;

        }

        global $_DATABASE;

        if(!isset($_DATABASE))
        {
            $_DATABASE = array();
        }

        if(!isset($_DATABASE[$type]))
        {
            $config = getConfig("servers");

            if(!isset($config[$type]))
            {
                return null;
            }

            $config = $config[$type];
            $server = getProperty($config, 'server');
            $user = getProperty($config, 'user');
            $pass = getProperty($config, 'password');
            $db =  getProperty($config, 'database');

            global $_DATABASE;
            $_DATABASE[$type] = new Database($server, $user, $pass, $db);
        }

        return $_DATABASE[$type];
    }

    function use_db($type)
    {
        if($type == 'local')
        {
            $type = 'mysql';
        }

        global $active_db;
        $active_db = $type;

    }

    function prepare_query($sql, $vars = null, $db_type = null)
    {
        if(!is_array($vars))
        {
            $vars = $_POST;
        }
        if(connected())
        {
            $vars['auth_id'] = auth_id();
        }

        //ToDo get default vars from js
        $db = db( $db_type );

        $index = 0;
        while(($index = @strpos($sql, '{@', $index)))
        {
            if(($index2 = strpos($sql, '}', $index)))
            {
                $name = substr($sql, $index+2, $index2 - $index-2);
                if(strpos($name, ' ') === false)
                {
                    $val = getProperty($vars, $name, '');
                    $val = $db->escape($val);
                    $sql = str_replace('{@'.$name.'}', $val, $sql);
                }
            }

            $index++;
        }

        $sql = str_replace("Ã©","é", $sql);
        return $sql;
    }

    function query($sql, $vars = null, $db_type = null)
    {
        $db = db( $db_type );
        $sql = prepare_query($sql, $vars, $db_type);

        if($db == null)
        {
            return null;
        }

        if($db->connected() == false)
        {
            return null;
        }

        return $db->query($sql);
    }

    function multi_query($sql, $vars = null, $get_result = false, $db_type = null)
    {
        $db = db( $db_type );
        $sql = prepare_query($sql, $vars, $db_type);

        if($db == null)
        {
            return null;
        }

        if(db()->connected() == false)
        {
            return null;
        }

        $r = $db->multi_query($sql);

        if($get_result === false)
        {
            while($db->more_results())
            {
                $db->next_result();
                $db->use_result();
            }
        }

        return $r;
    }

    function query_fetch($sql, $default = 0, $vars = null, $type = null)
    {
        if(is_string($vars))
        {
            $type = $vars;
            $vars = $_POST;
        }
        else if($vars == null)
        {
            $vars = $_POST;
        }

        $query = query($sql, $vars, $type);

        if(!is_object($query))
        {
            return $default;
        }

        if(($row = $query->fetchRow()))
        {
            return $row[0];
        }

        return $default;
    }

    function query_object($sql, $vars = null, $default = 0, $type = null)
    {
        if(is_string($vars))
        {
            $type = $vars;
            $vars = $_POST;
        }
        else if($vars == null)
        {
            $vars = $_POST;
        }

        $query = query($sql, $vars, $type);

        if(($row = $query->fetchObject()))
        {
            return $row;
        }

        return $default;
    }

    function check_connection($type = null)
    {
        $db = db($type);

        if($db == null)
        {
            api_result(array("error" => "Connection to the database fails", "db_error" => true));
            return false;
        }
        else if(!$db->connected())
        {
            if(!db()->reconnect())
            {
                api_result(array("error" => "Connection to the database fails", "db_error" => true));
                return false;
            }
        }

        return true;
    }

    function db_has_error()
    {
        if(db()->error())
        {
            if(is_local())
                api_error( db()->error() );
            else
                api_error('An internal error occured');

            return true;
        }

        return false;
    }