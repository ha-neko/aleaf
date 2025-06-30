// Game store links configuration
const gameStoreLinks = {
    'nso.jpg': 'https://store.steampowered.com/app/1451940/NEEDY_STREAMER_OVERLOAD/',
    'ddlc.jpg': 'https://store.steampowered.com/app/698780/Doki_Doki_Literature_Club/',
    'md.jpg': 'https://store.steampowered.com/app/774171/Muse_Dash/',
    'tnoyam.jpg': 'https://store.steampowered.com/app/2873080/The_NOexistenceN_of_you_AND_me/Me_and_You/',
    'pu.jpg': 'https://www.pokemon.com/us/pokemon-video-games/pokemon-unite',
    'hc.jpg': 'https://store.steampowered.com/app/2420510/HoloCure__Save_the_Fans/',
    'is.jpg': 'https://store.steampowered.com/app/1742020/Idol_Showdown/',
    'hoif.jpg': 'https://store.steampowered.com/app/1705430/Touhou_Hero_of_Ice_Fairy/',
    'co9.jpg': 'https://store.steampowered.com/app/1443200/Class_of_09/',
    'smss.jpg': 'https://store.steampowered.com/app/1639610/Save_Me_Sakuyasan/',
    'sg.jpg': 'https://store.steampowered.com/app/412830/STEINSGATE/'
};

// Game titles for better user experience
const gameTitles = {
    'nso.jpg': 'Needy Streamer Overload',
    'ddlc.jpg': 'Doki Doki Literature Club',
    'md.jpg': 'Muse Dash',
    'tnoyam.jpg': 'The NoexistenceN of Me and You',
    'pu.jpg': 'Pokémon UNITE',
    'hc.jpg': 'HoloCure - Save the Fans!',
    'is.jpg': 'Idol Showdown',
    'hoif.jpg': 'Hero of Ice Fairy',
    'co9.jpg': 'Class of \'09',
    'smss.jpg': 'Save Me, sakuya san',
    'sg.jpg': 'STEINS;GATE'
};

// Initialize store functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const gameImages = document.querySelectorAll('.game-images img');
    
    gameImages.forEach(img => {
        // Get the image filename from src
        const imgSrc = img.getAttribute('src');
        const storeLink = gameStoreLinks[imgSrc];
        const gameTitle = gameTitles[imgSrc];
        
        if (storeLink) {
            // Make image clickable
            img.style.transition = 'all 0.3s ease';
            
            // Add hover effects
            img.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.05)';
                this.style.filter = 'brightness(1.1)';
                this.style.boxShadow = '0 0 20px rgba(137, 216, 155, 0.8)';
            });
            
            img.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.filter = 'brightness(1)';
                this.style.boxShadow = '0 0 8px #89d89b';
            });
            
            // Add click functionality
            img.addEventListener('click', function() {
                // Add a click effect
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = 'scale(1.05)';
                    // Open store link in new tab
                    window.open(storeLink, '_blank');
                }, 100);
            });
            
            // Add title attribute for tooltip
            if (gameTitle) {
                img.setAttribute('title', `Click to view ${gameTitle} in store`);
            }
        }
    });
});

