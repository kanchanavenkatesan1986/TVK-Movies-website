/* Global JS functionality for TVK Movies */

function openNav() {
    const nav = document.getElementById("myNav");
    if (nav) {
        nav.classList.add("active");
        document.body.style.overflow = "hidden"; // Lock page scroll
    }
}

function closeNav() {
    const nav = document.getElementById("myNav");
    if (nav) {
        nav.classList.remove("active");
        document.body.style.overflow = ""; // Unlock page scroll
    }
}

// Close drawer on pressing Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeNav();
    }
});

// Highlight active bottom navigation item based on current page URL
document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    let page = path.split("/").pop();
    if (!page || page === "") page = "index.html";
    
    const navItems = document.querySelectorAll(".bottom-nav-item");
    navItems.forEach(item => {
        const href = item.getAttribute("href");
        if (href) {
            const itemPage = href.split("/").pop();
            if (itemPage === page) {
                item.classList.add("active");
            }
        }
    });
});

function shareApp() {
    const message =
        "TVK Movies-Tamil Cinemas 🎬\n\n" +
        "Watch Free Tamil & Hollywood Movies in Tamil 🎬\n\n" +
        "Download our app and enjoy unlimited entertainment!\n\n" +
        "Play Store:\nhttps://play.google.com/store/apps/details?id=com.vipmovies.tvkmovies&pcampaignid=web_share";

    if (navigator.share) {
        navigator.share({
            text: message
        }).catch(err => console.log("Error sharing:", err));
    } else {
        const whatsappURL = "https://wa.me/?text=" + encodeURIComponent(message);
        window.open(whatsappURL, "_blank");
    }
}