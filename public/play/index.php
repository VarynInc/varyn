<?php
require_once('../../services/common.php');
processSearchRequest();
$page = 'play';
$showSubscribe = getPostOrRequestVar('s', '0');
$gameId = getPostOrRequestVar(['id', 'gameid', 'game_id', 'gameId', 'gameName', 'g'], '');
if ($gameId == '') {
    header("Location: /games/");
}
$gameWidth = 1024;
$gameHeight = 768;
$pageDescription = '';
$gameInfo = null;
$gameCategory = '';
$receivedGameInfo = false;
$gameContainerHTML = '';
$isPlayBuzzSpecialCase = false;

// get game info: we need the game info immediately in order to build the page
// GameGet only works for numeric game_id, if game name we need to call GameGetByName
if (is_numeric($gameId)) {
    $gameInfo = $enginesis->gameGet($gameId);
} elseif ( ! empty($gameId)) {
    $gameInfo = $enginesis->gameGetByName($gameId);
} else {
    header("Location: /games/");
    exit(0);
}
if ($gameInfo != null) {
    $receivedGameInfo = true;
    $gameId = $gameInfo->game_id;
    $gameName = $gameInfo->game_name;
    $title = $gameInfo->title;
    $pageSocialImage1 = 'https://enginesis.varyn.com/games/' . $gameName . '/images/600x450.png';
    $pageSocialImageWidth = 600;
    $pageSocialImageHeight = 450;
    $pageSocialImage2 = 'https://enginesis.varyn.com/games/' . $gameName . '/images/586x308.png';
    $pageFavIcon = 'https://enginesis.varyn.com/games/' . $gameName . '/images/50x50.png';
    $pageIcon = 'https://enginesis.varyn.com/games/' . $gameName . '/images/50x50.png';
    $gameLink = currentPageURL();
    $pageOGLink = currentPageURL();
    $pageDescription = $gameInfo->short_desc;
    $pageKeywords = $gameInfo->keywords;
    $gameCategory = $gameInfo->game_style_category_name;
    $gameContainerHTML = setGameContainer($gameInfo, $enginesis->getServiceRoot(), $siteId, $gameId);
    // @todo: Discover what screenshot image files are available for this game
    $gameScreenShots = [
        'https://enginesis.varyn.com/games/' . $gameName . '/images/ss_1.jpg'
    ];
} else {
    // TODO: It may be better to go to /games/ with a search string ?q=$gameId but with an error message "Game not found"
    header("Location: /missing.php?m=" . urlencode("No information found for $gameId."));
    exit(0);
}

/**
 * Generate the necessary HTML to setup the game container div.
 */
function setGameContainer ($gameInfo, $enginesisServer, $siteId, $gameId) {
    global $authToken;

    $width = $gameInfo->width;
    $height = $gameInfo->height;
    $bgcolor = '#' . $gameInfo->bgcolor;
    $pluginId = $gameInfo->game_plugin_id;
    $allowScroll = $gameInfo->popup == 0 ? 'no' : 'yes';
    $gameContainerHTML = '<!-- debug: plugin=' . $pluginId . ' w/h=' . $width . 'x' . $height . '-->';
    if ($pluginId == 9) {
        // embed games go inside a <div> on the page rendered on this server
        $gameContainerHTML .= '<div id="gameContainer-iframe" style="position: relative; margin: 0 auto; width: 100%; height: 100%;">' . $gameInfo->game_link . '</div>';
    } else {
        if ($pluginId == 10) {
            // canvas games go inside an <iframe>
            if (strpos($gameInfo->game_link, '://') > 0) {
                // if the link specifies a protocol then it is a full URL to a webpage
                $gameLink = $gameInfo->game_link;
            } else {
                // otherwise it is a file in the games folder on the matching Enginesis server stage
                $gameLink = $enginesisServer . 'games/' . $gameInfo->game_name . '/' . $gameInfo->game_link;
            }
        } else {
            // all other types of game plugin games go inside an <iframe> to the matching Enginesis server stage
            $gameLink = $enginesisServer . 'games/play.php?site_id=' . $siteId . '&game_id=' . $gameId;
        }
        if ( ! empty($authToken)) {
            $gameLink = appendQueryParameter($gameLink, 'authtok', $authToken);
        }
        $gameContainerHTML .= '<iframe id="gameContainer-iframe" src="' . $gameLink . '" allowfullscreen scrolling="' . $allowScroll . '"></iframe>';
    }
    return $gameContainerHTML;
}

$pageTitle = $title . ' on Varyn.com';
include_once(VIEWS_ROOT . 'header.php');
?>
<div id="topContainer" class="container top-promo-area">
    <div id="gameContainer" class="row"><?php echo($gameContainerHTML);?></div>
    <div id="playgame-InfoPanel" class="row">
        <div class="panel panel-default">
            <div class="panel-body">
                <div id="gameInfo">
                <?php
                if ($receivedGameInfo) {
                    if (isset($gameInfo->is_favorite)) {
                        $isFavorite = ((int) $gameInfo->is_favorite) != 0;
                    } else {
                        $isFavorite = false;
                    }
                    $favoriteImgSrc = $isFavorite ? '/images/favorite-button-on-196.png' : '/images/favorite-button-off-196.png';
                    $favoriteHTML = '<li><img class="favorite-button" src="' . $favoriteImgSrc . '" data-gameid="' . $gameId . '" data-favorite="' . boolToString($isFavorite) . '" alt="Add ' . $gameInfo->game_name . ' to your favorite games" onclick="varynApp.favoriteButtonClicked(this);"></li>';
                    $shareFacebook = '<li><a href="https://www.facebook.com/sharer/sharer.php?u=' . $pageOGLink . '" target="_blank" title="Share ' . $title . ' with your Facebook network"><div class="facebook-small"></div></a></li>';
                    $shareTwitter = '<li><a href="https://twitter.com/share?text=Play ' . $title . ' on varyn.com:&url=' . $gameLink . '&via=varyn" target="_blank" title="Share ' . $title . ' with your Twitter followers"><div class="twitter-small"></div></a></li>';
                    $shareEmail = '<li><a href="mailto:?subject=Check out ' . $title . ' on varyn.com&body=I played ' . $title . ' on varyn.com and thought you would like to check it out: ' . $gameLink . '" title="Share ' . $title . ' by email"><div class="email-small"></div></a></li>';
                    echo('<div class="social-game-info"><ul>' . $favoriteHTML . $shareFacebook . $shareTwitter . $shareEmail . '</ul></div><h2>' . $title . '</h2><p>' . $gameInfo->long_desc . '</p>');
                } else {
                    echo('<p>No information regarding your request. Please check your entry.</p>');
                }
                ?>
                </div>
                <div id="gameDeveloper">
                </div>
            </div>
        </div>
    </div>
</div>
<div id="playgame-BottomPanel" class="container marketing">
    <div class="row">
        <div class="panel panel-default">
            <div class="panel-heading">
                <h3 class="panel-title">Other games you may like:</h3>
            </div>
        </div>
    </div>
    <div id="PlayPageGamesArea" class="row">
    </div>
    <div id="bottomAd" class="row">
    <?php
    $adProvider = 'google';
    include_once(VIEWS_ROOT . 'ad-spot.php');
    ?>
    </div>
</div>
<?php
include_once(VIEWS_ROOT . 'footer.php');
?>
<script type="text/javascript">

    var varynApp;

    head.ready(function() {
        siteConfiguration.gameId = '<?php echo($gameId);?>';
        pageParameters.width = '<?php echo($gameInfo->width);?>';
        pageParameters.height = '<?php echo($gameInfo->height);?>';
        pageParameters.pluginId = '<?php echo($gameInfo->game_plugin_id);?>';
        pageParameters.developerId = '<?php echo($gameInfo->developer_id);?>';
        varynApp = varyn(siteConfiguration);
        varynApp.initApp(varynPlayPage, pageParameters);
    });

    head.js("/common/modernizr.js", "/common/jquery.min.js", "/common/bootstrap.min.js", "/common/ie10-viewport-bug-workaround.js", "/common/enginesis.js", "/common/ShareHelper.js", "/common/commonUtilities.js", "/common/varyn.js", "/common/varynPlayPage.js");

</script>
</body>
</html>