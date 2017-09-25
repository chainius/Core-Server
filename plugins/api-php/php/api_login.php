<?php

    function check_blacklist_filter($username) {
        $username_okay = true;
        $bad_words = getConfig('wordsblacklist');      // Defined by ./config.php
        foreach ( $bad_words as $bad_word ) {
            if ( stripos($username, $bad_word) !== FALSE ) {
                $username_okay = false;
                break;
            }
        }
        return $username_okay;
    }