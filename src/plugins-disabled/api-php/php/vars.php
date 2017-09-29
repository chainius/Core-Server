<?php

    function server_ip()
    {
        return $_SERVER['SERVER_ADDR'];
    }

    function check_password_difficulty($input, &$msg)
    {
        //if(!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\.\$%\^&\*])(?=.{7,})/', $input))
        if(!preg_match('/^(?=.*[a-zA-Z])(?=.*[0-9])(?=.{7,})/', $input))
        {
            $msg = 'Wrong password format, Minimum 7 character with at least 1 numeric and 1 alhabetic character';//, 1 Uppercase , 1 Number and 1 Symbol';
            return false;
        }

        return true;
    }

    function percentage($number)
    {
        return number_format($number, 2, ',', ' ')."%";
    }

    function formatUrl($str, $sep='-')
    {
            $res = strtolower($str);
            $res = preg_replace('/[^[:alnum:]]/', ' ', $res);
            $res = preg_replace('/[[:space:]]+/', $sep, $res);
            return trim($res, $sep);
    }

    function input_checked($name)
    {
        if(isset($_POST[$name]))
        {
            if(strtolower($_POST[$name]) == "on" ||  strtolower($_POST[$name]) == "true" &&  $_POST[$name] == "1")
                return true;
        }

        return false;
    }

    function getProperty($array, $var, $default = null)
    {
        $array = (array) $array;
        return isset($array[$var]) ? $array[$var] : $default;
    }

    function connected()
    {
        return isset($_SESSION["auth_id"]);
    }

    function auth_id()
    {
        return isset($_SESSION["auth_id"]) ? $_SESSION["auth_id"] : 0;
    }

    function firstProperty($info, $property, $default = 0)
    {
        return getProperty( first($info), $property, $default );
    }

    function first($info)
    {
        if(is_array($info))
        {
            if(isset($info[0]))
            {
                return $info[0];
            }

            foreach($info as $val)
            {
                return $val;
            }
        }

        return $info;
    }

    function greatest($info , $key)
    {
        $lst = null;

        if(is_array($info))
        {
           foreach ($info as $k => $value) {
                $value = (array) $value;
               if($lst == null)
               {
                   $lst = $value;
               }
               else
               {
                  if ($value[$key] >= $lst[$key])
                  {
                    $lst = $value;
                  }
               }
            }
            return $lst;
        }

        return array();
    }

    function encrypt($data, $custom_pass = null)
    {
        return openssl_encrypt($data, 'aes-128-cbc', is_null($custom_pass) ? encrypt_pass : $custom_pass, true, encrypt_iv);
    }

    function decrypt($data, $custom_pass = null)
    {
        return openssl_decrypt($data, 'aes-128-cbc', is_null($custom_pass) ? encrypt_pass : $custom_pass, true, encrypt_iv);
    }

    function getNumericProperty($array, $var, $default = 0)
    {
        $result = getProperty($array, $var, $default);
        return is_numeric($result) ? $result : $default;
    }

    function check_type($var, $type)
    {
        switch($type)
        {
            case "string":
                return is_string($var);
                break;
            case "numeric":
                return is_numeric($var);
                break;
            case "positive":
                return is_numeric($var) && $var >= 0;
                break;
            case "positive+":
                return is_numeric($var) && $var > 0;
                break;
            case "array":
                return is_array($var);
                break;
            case "object":
                return is_object($var);
                break;
            case "no":
                return true;
                break;
            case 'action_id':
                return preg_match("/([A-Z]{3})-([0-9]{3})\s/", $var.' ');
                break;
        }

        return false;
    }

    function check_variables($vars, $inarr = null, $only_bool = false)
    {
        if($inarr == null)
        {
            $inarr = $_POST;
        }

        foreach($vars as $key => $value)
        {
            $type_filter = true;

            if(is_numeric($key))
            {
                $key = $value;
                $type_filter = false;
            }

            if(!isset($inarr[$key]))
            {
                if(!$only_bool)
                    api_error("Variable $key not found", true);
                return false;
            }
            if($type_filter)
            {
                if(!check_type($inarr[$key], $value))
                {
                    if(!$only_bool)
                        api_error("Variable $key has a wrong type (needed: {$value})", true);
                    return false;
                }
            }
        }

        return true;
    }

    function client_ip()
    {
        return getenv('client_ip');
    }

    function Library($libName)
	{
        $path = __DIR__."/libs/".$libName.".php";
        $exist = file_exists($path);

        if($exist)
        {
             include_once($path);
        }
	}