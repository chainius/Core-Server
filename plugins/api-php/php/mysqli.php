<?php
    global $mysql_time;

    $mysql_time = 0;

    class Database
    {
        var $link;
        var $closed;
        var $auto_close;
        var $db_name;
        
        var $settings;
        
        function __construct($server, $user, $pass, $database=null)
        {
            global $mysql_time;
            $start = microtime(1);
            
            $this->closed = false;
            $this->auto_close = true;
            $this->db_name = $database;
                
            if(!function_exists("mysqli_connect"))
            {
                throw new Exception('mysqli_connect not declared');
            }
            else
            {
                if(($pos = strpos($server, ":")))
                {
                    $port = substr($server, $pos+1);
                    $server = substr($server, 0, $pos);
                    //print "Server: $server<br>Port: $port<br>";
                    $this->link = @mysqli_connect($server, $user, $pass, null, $port);
                    
                    $this->settings = array('server' => $server, 'user' => $user, 'pass' => $pass, 'port' => $port);
                }
                else
                {
                    $this->link = @mysqli_connect($server, $user, $pass);
                }

                if(isset($database) && $this->connected())
                {
                   $this->set_database($database);
                }
            }
            
            $mysql_time += (microtime(1) - $start);
        }
        
        function __destruct()
        {
            global $mysql_time;
            $start = microtime(1);

            if(!$this->auto_close)
            {
                $mysql_time += (microtime(1) - $start);
                return;
            }
            
            $this->close();
            
            global $_DATABASE;
            
            if(!is_array($_DATABASE))
            {
                $mysql_time += (microtime(1) - $start);
                return;
            }
            
            foreach($_DATABASE as $key => $db)
            {
                if($db == $this)
                {
                    unset($_DATABASE[$key]);
                    break;
                }
            }
            
            $mysql_time += (microtime(1) - $start);
        }
        
        function reconnect()
        {
            global $mysql_time;
            $start = microtime(1);
            
            $settings = $this->settings;
            $this->close();
            $this->link = mysqli_connect($settings['server'], $settings['user'], $settings['pass'], null, $settings['port']);
            
            if($this->connected(true))
            {
                $this->closed = false;
                $this->set_database($this->db_name);
                $mysql_time += (microtime(1) - $start);
                return true;
            }
            
            $mysql_time += (microtime(1) - $start);
            return false;
        }
        
        function error()
        {
            global $mysql_time;
            $start = microtime(1);
            
            if(!$this->connected())
            {
                return $this->connect_error();
            }
            $err = mysqli_error($this->link);
            
            $mysql_time += (microtime(1) - $start);
            return $err;
        }
        
        function errno()
        {
            return mysqli_connect_errno($this->link);
        }
        
        function state()
        {
            return mysqli_sqlstate($this->link);
        }
        
        function getLink()
        {
            return $this->link;   
        }
        
        function connected($parse_closed = false)
        {
            return $this->closed && !$parse_closed ? false : (mysqli_connect_errno($this->link) ? false : true);  
        }
        
        function connect_error()
        {
            return mysqli_connect_error ($this->link);
        }
        
        function set_database($database)
        {
            mysqli_select_db($this->link, $database);
        }
        
        function escape($string)
        {
            global $mysql_time;
            $start = microtime(1);
            $esc = @mysqli_real_escape_string($this->link, $string);
            $mysql_time += (microtime(1) - $start);
            return $esc;
        }
        
        function query($query)
        {
            global $mysql_time;
            $start = microtime(1);
            $qr = new _Mysqli_Result(@mysqli_query($this->link, $query), $this->link); 
            
            $mysql_time += (microtime(1) - $start);
            return $qr;
        }
        
        function multi_query($query)
        {
            global $mysql_time;
            $start = microtime(1);
            $qr = $this->link->multi_query($query);
            
            $mysql_time += (microtime(1) - $start);
            return $qr;
        }
        
        function store_result()
        {
            global $mysql_time;
            $start = microtime(1);
            
            $res = $this->link->store_result();
            if($res === false)
            {
                return false;
            }
            
            $res = new _Mysqli_Result($res, $this->link);
            
            $mysql_time += (microtime(1) - $start);
            return $res;
        }
        
        function more_results()
        {
            return $this->link->more_results();
        }
        
        function next_result()
        {
            return $this->link->next_result();
        }
        
        function use_result()
        {
            return $this->link->store_result();
        }
        
        function affected_rows()
        {
            global $mysql_time;
            $start = microtime(1);
            $af = @mysqli_affected_rows($this->link);
            
            $mysql_time += (microtime(1) - $start);
            return $af;
        }
        
        function insert_id()
        {
            global $mysql_time;
            $start = microtime(1);
            $id = mysqli_insert_id($this->link);
            
            $mysql_time += (microtime(1) - $start);
            return $id;
        }
        
        function database()
        {
            $dbRes = $this->query("SELECT DATABASE()");
            return $dbRes->fetchRow(0);
        }
        
        function databases()
        {
            return $this->json_query("SHOW DATABASES", 0);
        }
        
        function tables($database)
        {
            return $this->json_query("SHOW TABLES FROM $database", 0);
        }
        
        function json_query($query, $field=null)
        {
            if(is_string($query))
            {
                $query = $this->query($query);   
            }
            
            $result = array();
            
            if(!is_numeric($field))
            {
                while(($row = $query->fetchObject()))
                {
                    $result[] = ($field == null) ? $row : $row->$field;
                }   
            }
            else
            {
                while(($row = $query->fetchRow()))
                {
                    $result[] = $row[$field];
                }   
            }
            
            return $result;
        }
        
        function close()
        {
            //console_log("close connection");
            $this->closed = true;
            @mysqli_close($this->link);
        }
    }

    class _Mysqli_Result
    {
        var $dbRes, $link, $fields, $fetchLimits = null;
        
        function __construct($query_result, $_link)
        {
            $this->dbRes = $query_result;
            $this->link = $_link;
        }
        
        function hasErrors()
        {
            return ($dbRes == false);
        }
        
        function error()
        {
            return mysqli_error($this->link);
        }
        
        function field($i)
        {
            if($this->fields == null)
            {
                $this->fields = $this->dbRes->fetch_fields();
            }

            return isset($this->fields[$i]) ? $this->fields[$i]->name : null;
        }
        
        function fieldsCount()
        {
            if($this->fields == null)
            {
                $this->fields = $this->dbRes->fetch_fields();
            }

            return count($this->fields);
        }
        
        function fetchObject()
        {
            global $mysql_time;
            $start = microtime(1);
            $res = false;

            if($this->fetchLimits != 0 || is_null($this->fetchLimits))
            {
                $this->fetchLimits = ($this->fetchLimits == null) ? null : $this->fetchLimits-1;
                $res = @mysqli_fetch_object($this->dbRes);
            }
            
            $mysql_time += (microtime(1) - $start);
            return $res;
        }
        
        function fetchArray()
        {
            global $mysql_time;
            $start = microtime(1);
            $res = false;
            
            if($this->fetchLimits != 0 || is_null($this->fetchLimits))
            {
                $this->fetchLimits = ($this->fetchLimits == null) ? null : $this->fetchLimits-1;
                $res = @mysqli_fetch_array($this->dbRes);
            }
            
            $mysql_time += (microtime(1) - $start);
            return $res;
        }     
        
        function fetchRow($index=null)
        {
            global $mysql_time;
            $start = microtime(1);
            $res = false;

            if($this->fetchLimits != 0 || is_null($this->fetchLimits))
            {
                $this->fetchLimits = ($this->fetchLimits == null) ? null : $this->fetchLimits-1;
                $row = @mysqli_fetch_row($this->dbRes);
                $res = is_numeric($index) ? $row[$index] : $row;
            }
            
            $mysql_time += (microtime(1) - $start);
            return $res;
        }
        
        function getAll()
        {
            $result = array();

            while(($row = $this->fetchObject()))
            {
                $result[] = $row;
            }
            
            return $result;
        }
        
        function getColumns()
        {
            return mysqli_fetch_fields($this->dbRes);   
        }
        
        function count()
        {
            global $mysql_time;
            $start = microtime(1);
            $res = false;
            $res = @mysqli_num_rows($this->dbRes);
            $mysql_time += (microtime(1) - $start);
            return $res;
        }
        
        function setLimits($start, $limit)
        {
            if($this->dbRes)
            {
                $this->fetchLimits = $limit;
                $this->dbRes->data_seek($start);
            }
        }
    }