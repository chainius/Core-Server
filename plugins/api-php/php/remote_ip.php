<?php

    function log_remote_api_fail($server, $name, $vars, $description)
    {
        $user_id = 0;
        if(isset($vars['user_id']))
        {
            $user_id = $vars['user_id'];
        }
        else if(connected())
        {
            $user_id = auth_id();
        }

        api('remote', 'add_fail', array('server' => $server, 'name' => $name, 'vars' => json_encode($vars), 'user_id' => $user_id, 'description' => $description));
    }

    function remote_api($server, $name, $vars = null, $with_token = true, $retry = true, $post = true)
    {
        $url = 'https://'.$server.'/'.$name;

        if(is_null($vars))
        {
            $vars = $_POST;
        }
        if(!is_array($vars))
        {
            $vars = (array) $vars;
        }
        if($with_token)
        {
            $vars['token'] = remote_token();
        }


        $params = array('http' => array(
              'method' => 'POST',
              'content' => http_build_query($vars)
        ));

        $ctx = stream_context_create($params);
        $fp = @fopen($url, 'rb', false, $ctx);
        if (!$fp) {
             return array('error' => "Unable to contact server");
        }
        $response = @stream_get_contents($fp);
        if ($response === false) {
            return array('error' => "Unable to contact server");
        }

       /* $ch = curl_init($url);

        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
         print_r(curl_getinfo($ch));
        if($post)
        {
            curl_setopt($ch,CURLOPT_POST, count($vars));
            curl_setopt($ch,CURLOPT_POSTFIELDS, http_build_query($vars));
        }

        $response = curl_exec($ch);*/

        $content = json_decode($response);

        if(is_array($content) || is_object($content))
        {
            $content = (array)$content;
            if($retry && isset($content['error']))
            {
                if(is_string($content['error']))
                    if(substr($content['error'], 0, 16) == 'Wrong token send')
                    {
                        return remote_api($server, $name, $vars, true, false);
                    }

                return array('error' => $content['error']);
            }
            else if(isset($content['error']) && $with_token)
            {
                if(substr($content['error'], 0, 16) == 'Wrong token send')
                    log_remote_api_fail($server, $name, $vars, $content['error']);
            }

            return $content;
        }

        if(is_null($content) && $with_token)
        {
            log_remote_api_fail($server, $name, $vars, 'Server unreachable: '.$response);
        }

        return array('error' => $response);
    }


    //------------------------------------------------------------------------------------------------

    global $mailSends;
    $mailSends = [];

    function auto_mail($layout, $vars, $priority = false)
    {
        global $mailSends;

        if(!isset($vars['dest_mail']))
        {
            return array('error' => 'dest_mail not found');
        }
        if(!isset($vars['user_id']) && !connected())
        {
            return array('error' => 'user_id not found and user not connected');
        }

        $vars['name'] = isset($vars['name']) ? $vars['name'] : null;
        $vars['user_id'] = isset($vars['user_id']) ? $vars['user_id'] : auth_id();

        $mailSends[] = [
            'layout' => $layout,
            'vars'   => $vars
        ];

        return true;
    }
