function openNav(){
    document.getElementById("myNav").classList.add("active");
}

function closeNav(){
    document.getElementById("myNav").classList.remove("active");
}



    function shareApp() {

    var message =
        "TVK Movies-Tamil Cinemas 🎬\n\n" +
        "Watch Free Tamil & Hollywood Movies Watch Free in Tamil 🎬\n\n" +
        "Download our app and enjoy unlimited entertainment!\n\n" +
        "Play Store:\nhttps://play.google.com/store/apps/details?id=com.vipmovies.tvkmovies&pcampaignid=web_share";

    if (navigator.share) {

        navigator.share({
            text: message
        });

    } else {

        var whatsappURL = "https://wa.me/?text=" + encodeURIComponent(message);
        window.open(whatsappURL, "_blank");

    }
}