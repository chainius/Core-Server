<?php

    function api_count_result($sql, $count_table)
    {
        $_POST['start'] = getNumericProperty($_POST, 'start', 0);
        $_POST['limit'] = getNumericProperty($_POST, 'limit', 15);

        api_query($sql." LIMIT {@start}, {@limit}");

        global $_RESULT;
        return $_RESULT;
    }

    function api_save($update_query, $insert_query, $id = 'id')
    {
        if(isset($_POST[$id]))
        {
            if($_POST[$id] != -1 && is_numeric($_POST[$id]))
            {
                return api_query($update_query);
            }
        }

        $res = api_query($insert_query);
        global $_RESULT;
        $_RESULT['id'] = db()->insert_id();
        return $res;
    }