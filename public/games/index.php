<?php
require_once('../../services/common.php');
$page = 'games';
$pageTitle = 'All games at Varyn.com';
$pageDescription = 'Check out some of the games that are in development, betas, experiments in new game play ideas, and the research and development going on at Varyn.com.';
$search = fullyCleanString(getPostOrRequestVar('q', ''));
$showSubscribe = getPostOrRequestVar('s', '0');
include_once(VIEWS_ROOT . 'header.php');
?>
<div class="container marketing">
    <?php
    if ($search != '') {
        ?>
        <div class="panel panel-primary">
            <div class="panel-heading">
                <h3 class="panel-title">Search for:</strong> <?php echo($search);?></h3>
            </div>
        </div>
    <?php
    }
    ?>
    <div id="AllGamesArea" class="row">
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
<script>

    var varynApp;

    head.ready(function() {
        varynApp = varyn(siteConfiguration);
        varynApp.initApp(varynAllGamesPage, pageParameters);
    });

    head.js("/common/modernizr.js", "/common/jquery.min.js", "/common/bootstrap.min.js", "/common/ie10-viewport-bug-workaround.js", "/common/enginesis.js", "/common/ShareHelper.js", "/common/commonUtilities.js", "/common/varyn.js", "/common/varynAllGamesPage.js");

</script>
</body>
</html>