<?php
    /**
     * Handle reset password from email request. If user, site, token match secondary password lookup and
     * not expired, then accept a new password from a form. THis page is intended to be called from a link such as
     * http://%domain%/procs/resetpass.php?id=10093&e=1e6&s=%site_id%&u=%user_id%&t=%token%
     * @Date: 6/18/2016
     *
     * TEST: http://www.varyn-l.com/procs/resetpass.php?id=10093&e=1e6&s=106&u=10239&t=1234
     */
    require_once('../../services/common.php');
    $debug = true;
    $page = 'profile';
    $search = getPostOrRequestVar('q', null);
    if ($search != null) {
        header('location:/allgames.php?q=' . $search);
        exit;
    }
    processTrackBack();
    $showSubscribe = getPostOrRequestVar('s', '0');
    $user_id = getPostOrRequestVar('u', 0);
    $site_id = getPostOrRequestVar('s', 0);

    // User must be logged in to call this page:
    $authToken = '';
    $token = '';
    if ($site_id > 0 && $user_id > 0) { // make sure page is called with correct parameters
        $token = getPostOrRequestVar('t', ''); // this is the password reset token generated by and sent in the email.
    }
    if ($isLoggedIn) {
        $userInfo = getVarynUserCookieObject();
        $authToken = $userInfo->authtok;
        $user_id = $userInfo->user_id; // only use the user_id that is logged in
        $site_id = $userInfo->site_id;
    }
    if ($site_id > 0 && $user_id > 0 && ! empty($authToken) && strlen($token) > 0) {
        $action = getPostOrRequestVar('action', 'reset');
        $hackerToken = isset($_POST['clearall']) ? $_POST['clearall'] : '';          // must match token when page loaded
        $hackerHoneyPot = isset($_POST['emailaddress']) ? $_POST['emailaddress'] : ''; // must be empty
        $newPassword = isset($_POST['newPassword']) ? $_POST['newPassword'] : '';
        $retypePassword = isset($_POST['retypePassword']) ? $_POST['retypePassword'] : '';
        $newPasswordSet = false;
        $hashPassword = '';
        $language_code = $enginesis->getLanguageCode();
        $networkId = $enginesis->getNetworkId();
        $redirectTo = '';
        $errorMessage = '';
        $errorFieldId = '';
        $inputFocusId = '';
        $hackerVerification = '';
        $isValidRequest = $action == 'resetpassword' && empty($hackerHoneyPot) && validateInputFormHackerToken($hackerToken);
        if ($newPassword == '') {
            // First time in: prompt for a new password
            $hackerVerification = makeInputFormHackerToken();
        } elseif ( ! $isValidRequest) {
            $redirectTo = '/profile.php';
            // Should log this was most probably a hack attack
        } elseif ($enginesis->isValidPassword($newPassword) && $newPassword == $retypePassword) {
            $serverResponse = $enginesis->registeredUserPasswordChange($newPassword, $token);
            if ($serverResponse == null) {
                // TODO: Need to handle any errors
                $errorCode = $enginesis->getLastError();
                if ($errorCode == 'INVALID_SECONDARY_PASSWORD') {
                    $errorMessage = "Your password change request is invalid or is has expired.";
                } elseif ($errorCode == 'NOT_AUTHENTICATED') {
                    $errorMessage = "Your must be logged in to change your password.";
                } else {
                    $errorMessage = "There was a system error saving your information (" . $enginesis->getLastErrorDescription() . ")";
                }
                $errorMessage = "<p class=\"error-text\">$errorMessage Please <a href=\"/profile.php\">begin the request again</a>.</p>";
                $hackerVerification = makeInputFormHackerToken();
            } else {
                $newPasswordSet = true;
            }
        } else {
            $sql = '';
            $errorMessage = '<p class="errormsg">Invalid password. Your password must match and be between 4 and 20 characters without leading or trailing space.</p>';
        }
    } else {
        // not a valid request
        $redirectTo = '/profile.php';
    }
    if ( ! $debug && $redirectTo != '') {
        header('Location: ' . $redirectTo); // Anything we don't like just redirect to the home page
        return;
    }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Reset Password | Varyn</title>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Access-Control-Allow-Origin" content="*">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta http-equiv="cache-control" content="max-age=0" />
    <meta http-equiv="cache-control" content="no-cache" />
    <meta http-equiv="expires" content="0" />
    <meta http-equiv="expires" content="Tue, 01 Jan 1980 1:00:00 GMT" />
    <meta http-equiv="pragma" content="no-cache" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="description" content="Reset user password at Varyn.com.">
    <meta name="author" content="Varyn">
    <meta name="google-signin-client_id" content="AIzaSyD22xO1Z71JywxmKfovgRuqZUHRFhZ8i7A.apps.googleusercontent.com">
    <link href="../common/bootstrap.min.css" rel="stylesheet">
    <link href="../common/carousel.css" rel="stylesheet">
    <link href="../common/varyn.css" rel="stylesheet">
    <link rel="icon" href="../favicon.ico">
    <link rel="icon" type="image/png" href="../favicon-48x48.png" sizes="48x48"/>
    <link rel="icon" type="image/png" href="../favicon-196x196.png" sizes="196x196">
    <link rel="icon" type="image/png" href="../favicon-160x160.png" sizes="160x160">
    <link rel="icon" type="image/png" href="../favicon-96x96.png" sizes="96x96">
    <link rel="icon" type="image/png" href="../favicon-16x16.png" sizes="16x16">
    <link rel="icon" type="image/png" href="../favicon-32x32.png" sizes="32x32">
    <link rel="apple-touch-icon" href="../apple-touch-icon-60x60.png" sizes="60x60"/>
    <link rel="apple-touch-icon" href="../apple-touch-icon-72x72.png" sizes="72x72"/>
    <link rel="apple-touch-icon" href="../apple-touch-icon-76x76.png"/>
    <link rel="apple-touch-icon" href="../apple-touch-icon-76x76.png" sizes="76x76"/>
    <link rel="apple-touch-icon" href="../apple-touch-icon-114x114.png" sizes="114x114"/>
    <link rel="apple-touch-icon" href="../apple-touch-icon-120x120.png" sizes="120x120"/>
    <link rel="apple-touch-icon" href="../apple-touch-icon-152x152.png" sizes="152x152"/>
    <link rel="shortcut icon" href="../favicon-196x196.png">
    <meta property="fb:app_id" content="" />
    <meta property="fb:admins" content="726468316" />
    <meta property="og:title" content="Reset password at Varyn.com">
    <meta property="og:url" content="http://www.varyn.com/procs/resetpass.php">
    <meta property="og:site_name" content="Varyn">
    <meta property="og:description" content="Reset user password at Varyn.com.">
    <meta property="og:image" content="http://www.varyn.com/images/1200x900.png"/>
    <meta property="og:image" content="http://www.varyn.com/images/1024.png"/>
    <meta property="og:image" content="http://www.varyn.com/images/1200x600.png"/>
    <meta property="og:image" content="http://www.varyn.com/images/600x600.png"/>
    <meta property="og:image" content="http://www.varyn.com/images/2048x1536.png"/>
    <meta property="og:type" content="game"/>
    <meta name="twitter:card" content="photo"/>
    <meta name="twitter:site" content="@varyndev"/>
    <meta name="twitter:creator" content="@varyndev"/>
    <meta name="twitter:title" content="Varyn: Great games you can play anytime, anywhere"/>
    <meta name="twitter:image:src" content="http://www.varyn.com/images/600x600.png"/>
    <meta name="twitter:domain" content="varyn.com"/>
    <script src="../common/head.min.js"></script>
</head>
<body>
<?php
include_once('../common/header.php');
?>
<div class="container marketing">
    <div class="row leader-3">
        <div class="col-md-4 col-md-offset-4">
            <div class="panel panel-primary">
                <div class="panel-heading">
                    <h1 class="panel-title">Change Password</h1>
                </div>
                <div class="panel-body">
                    <?php
                    if ($newPasswordSet) {
                    ?>
                        <p>Your password has been changed. To verify, please logout and then log in with your new password.</p>
                        <ul>
                            <li><a href="/">Home</a></li>
                            <li><a href="/profile.php">Your profile</a></li>
                            <li><a href="login.php">Login again</a></li>
                            <li><a href="mailto:support@enginesis.com">Contact Support</a></li>
                        </ul>
                    <?php
                    } else {
                    ?>
                    <form id="forgot-password-form" method="POST" action="" onsubmit="return varynApp.formResetPasswordClicked();">
                        <div class="popupMessageArea">
                            This is the response from the server
                        </div>
                        <?php
                        if (empty($errorMessage)) {
                        ?>
                            <p>Please enter your new password and also verify it, then select Change to change your password.</p>
                            <?php
                        } else {
                            echo($errorMessage);
                        }
                        ?>
                        <div class="form-group">
                            <label for="newPassword">New password:</label><br/>
                            <input type="password" id="newPassword" name="newPassword" tabindex="23" maxlength="20" required class="form-control"  placeholder="New password" autocorrect="off" autocapitalize="off" autocomplete="off"/>
                        </div>
                        <div class="form-group">
                            <label for="retypePassword">Retype it:</label><br/>
                            <input type="password" id="retypePassword" name="retypePassword" tabindex="24" maxlength="20" required class="form-control" placeholder="Retype new password" autocapitalize="off" autocorrect="off" autocomplete="off"/>
                        </div>
                        <div class="form-group">
                            <input type="submit" class="btn btn-success disabled" id="reset-password-button" value="Change" tabindex="25"/><img id="password-match" class="password-match" src="/images/green_tick.png" width="32" height="32"/>
                            <input type="hidden" name="action" value="resetpassword" /><input type="text" name="emailaddress" class="popup-form-address-input" /><input type="hidden" name="clearall" value="<?php echo($hackerVerification);?>" /><input type="hidden" name="s" value="<?php echo($site_id);?>" /><input type="hidden" name="u" value="<?php echo($user_id);?>" /><input type="hidden" name="t" value="<?php echo($token);?>" />
                        </div>
                    </form>
                    <p class="info-text-small">Password security is something we take very seriously. Please use a password that is at least 12 characters and does not conform to any common patterns.</p>
                    <?php
                    }
                    ?>
                </div>
            </div>
        </div>
    </div>
    <?php
    if ($debug == 1) {
        echo("<div class=\"row\"><h3>Debug info:</h3><p>Page called with action $action; User id $user_id; site id: $site_id; token: $token; password $newPassword, $retypePassword;</p><p>redirect to $redirectTo</p><p>Honeypot: $hackerHoneyPot</p><p>Hacker token: $hackerToken; Current token: " . makeInputFormHackerToken() . "</p></div>");
    }
    ?>
    <div id="bottomAd" class="row">
        <script async src="//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
        <!-- Varyn Responsive -->
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="ca-pub-9118730651662049"
             data-ad-slot="5571172619"
             data-ad-format="auto"></ins>
        <script>
            (adsbygoogle = window.adsbygoogle || []).push({});
        </script>
    </div>
</div>
<?php
include_once('../common/footer.php');
?>
<script>

    var varynApp,
        resetPasswordPage;

    head.ready(function() {
        var siteConfiguration = {
                siteId: <?php echo($siteId);?>,
                gameId: 0,
                gameGroupId: 0,
                serverStage: "<?php echo($stage);?>",
                languageCode: navigator.language || navigator.userLanguage,
                developerKey: '<?php echo($developerKey);?>',
                facebookAppId: '<?php echo($socialServiceKeys[2]['app_id']);?>',
                authToken: '<?php echo($authToken);?>'
            },
            resetPasswordPageParameters = {
                errorFieldId: "<?php echo($errorFieldId);?>",
                inputFocusId: "<?php echo($inputFocusId);?>",
                showSubscribe: "<?php echo($showSubscribe);?>"
            };
        varynApp = varyn(siteConfiguration);
        resetPasswordPage = varynApp.initApp(varynResetPasswordPage, resetPasswordPageParameters);
    });

    head.js("/common/modernizr.js", "/common/jquery.min.js", "/common/bootstrap.min.js", "/common/ie10-viewport-bug-workaround.js", "//platform.twitter.com/widgets.js", "https://apis.google.com/js/platform.js", "/common/enginesis.js", "/common/ShareHelper.js", "/common/commonUtilities.js", "/common/varyn.js", "/common/varynResetPasswordPage.js");

</script>
</body>
</html>