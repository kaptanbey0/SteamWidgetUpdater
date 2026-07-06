// Steam → Discord Widget Updater
// Runs in GitHub Actions

// Environment Variables

const {
    STEAM_API_KEY,
    STEAM_ID,
    STEAM_ID_2,
    BOT_TOKEN,
    APPLICATION_ID,
    DISCORD_USER_ID
} = process.env;

// Validate Secrets

const requiredSecrets = [
    "STEAM_API_KEY",
    "STEAM_ID",
    "BOT_TOKEN",
    "APPLICATION_ID",
    "DISCORD_USER_ID"
];

for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
        throw new Error(`Missing GitHub Secret: ${secret}`);
    }
}

// Logging

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Delay Helper

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch JSON with Retries

async function steam(url, retries = 3) {

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {

        try {

            const res = await fetch(url);

            if (!res.ok) {

                const text = await res.text();

                throw new Error(
                    `Steam API ${res.status}\n${text}`
                );

            }

            return await res.json();

        } catch (err) {

            lastError = err;

            log(
                `Steam request failed (${attempt}/${retries})`
            );

            if (attempt !== retries) {
                await delay(1500);
            }

        }

    }

    throw lastError;

}

// Account Age

async function getProfileAge(steamId) {

    try {

        const response = await fetch(
            `https://steamcommunity.com/profiles/${steamId}/?xml=1`
        );

        if (!response.ok) {
            return "Unknown";
        }

        const xml = await response.text();

        const match = xml.match(
            /<memberSince>(.*?)<\/memberSince>/
        );

        if (!match) {
            return "Unknown";
        }

        const created = new Date(match[1]);

        if (isNaN(created)) {
            return "Unknown";
        }

        const now = new Date();

        let years =
            now.getFullYear() -
            created.getFullYear();

        const monthDiff =
            now.getMonth() -
            created.getMonth();

        if (
            monthDiff < 0 ||
            (
                monthDiff === 0 &&
                now.getDate() < created.getDate()
            )
        ) {
            years--;
        }

        return `${years} Years`;

    }

    catch {

        return "Unknown";

    }

}

const SYSTEM_BADGES = {
    1: "Community Leader",
    2: "Years of Service",
    12: "Steam Summer Sale 2013",
    13: "Steam Holiday Sale 2013",
    14: "Steam Translation Project",
    15: "Steam Moderator",
    16: "Valve Employee",
    17: "Winter Sale 2013",
    18: "Steam Greenlight",
    21: "Summer Adventure 2014",
    22: "Auction 2014",
    23: "Holiday Sale 2014",
    24: "Monster Summer Game 2015",
    25: "Summer Sale 2016",
    26: "Steam Awards Nominations 2016",
    27: "The Steam Awards 2016",
    28: "Winter Sale 2016",
    29: "Summer Sale 2017",
    30: "The Steam Awards 2017",
    31: "Winter Sale 2017",
    32: "Summer Sale 2018",
    33: "The Steam Awards 2018",
    34: "Winter Sale 2018",
    35: "Summer Sale 2019",
    36: "The Steam Awards 2019",
    37: "Winter Sale 2019",
    38: "Spring Cleaning 2020",
    39: "Summer Sale 2020",
    40: "The Steam Awards 2020",
    41: "Winter Sale 2020",
    42: "Summer Sale 2021",
    43: "The Steam Awards 2021",
    44: "Winter Sale 2021",
    45: "Summer Sale 2022",
    46: "The Steam Awards 2022",
    47: "Winter Sale 2022",
    48: "Summer Sale 2023",
    49: "The Steam Awards 2023",
    50: "Winter Sale 2023",
    51: "Summer Sale 2024",
    52: "The Steam Awards 2024",
    53: "Winter Sale 2024",
    54: "Summer Sale 2025",
    55: "The Steam Awards 2025",
    56: "Winter Sale 2025",
    57: "Summer Sale 2026",
    58: "The Steam Awards 2026",
    59: "Winter Sale 2026"
};

function getBadgeName(badge, gamesList) {
    if (badge.appid) {
        const game = gamesList.find(g => g.appid === badge.appid);
        const gameName = game ? game.name : `App ${badge.appid}`;
        const isFoil = badge.border_color === 1;
        return `${gameName} ${isFoil ? "Foil Badge" : "Badge"}`;
    }

    if (badge.badgeid === 1) {
        if (badge.level === 1) return "Community Pillar";
        if (badge.level === 2) return "Community Ambassador";
        return "Community Leader";
    }

    if (badge.badgeid === 2) {
        return `${badge.level} Years of Service`;
    }

    return SYSTEM_BADGES[badge.badgeid] || `Steam Badge #${badge.badgeid}`;
}

function getXpRequiredForLevel(level) {
    let xp = 0;
    for (let i = 0; i < level; i++) {
        xp += (Math.floor(i / 10) + 1) * 100;
    }
    return xp;
}

function calculateXpProgress(badgesResponse, fallbackLevel) {
    if (!badgesResponse) return "0 XP (0% to Lvl 1)";
    const playerXp = badgesResponse.player_xp || 0;
    const playerLevel = badgesResponse.player_level || fallbackLevel || 0;

    const xpForCurrentLevel = getXpRequiredForLevel(playerLevel);
    const xpForNextLevel = getXpRequiredForLevel(playerLevel + 1);
    const xpDifference = xpForNextLevel - xpForCurrentLevel;
    const currentLevelProgressXp = playerXp - xpForCurrentLevel;

    let xpProgressPercent = 0;
    if (xpDifference > 0) {
        xpProgressPercent = Math.max(0, Math.min(100, Math.round((currentLevelProgressXp / xpDifference) * 100)));
    }

    return `${playerXp.toLocaleString()} XP (${xpProgressPercent}% to Lvl ${playerLevel + 1})`;
}



// Discord Widget Updater

async function updateDiscordWidget(widget) {

    log("Updating Discord widget...");

    const response = await fetch(
        `https://discord.com/api/v9/applications/${APPLICATION_ID}/users/${DISCORD_USER_ID}/identities/0/profile`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${BOT_TOKEN}`,
                "Content-Type": "application/json",
                "User-Agent":
                    "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)"
            },
            body: JSON.stringify(widget)
        }
    );

    if (!response.ok) {

        const text = await response.text();

        throw new Error(
            `Discord API ${response.status}\n${text}`
        );

    }

    log("Discord widget updated.");

}

// Main

async function main() {

    const steamId1 = STEAM_ID;
    const steamId2 = STEAM_ID_2 || null;

    log("Fetching Steam data for Account 1...");

    const [
        summary,
        owned,
        recent,
        level,
        badges,
        friendsRaw,
        profileAge
    ] = await Promise.all([

        steam(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId1}`
        ),

        steam(
            `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId1}&include_appinfo=1&include_played_free_games=1`
        ),

        steam(
            `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId1}`
        ),

        steam(
            `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${STEAM_API_KEY}&steamid=${steamId1}`
        ),

        steam(
            `https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=${STEAM_API_KEY}&steamid=${steamId1}`
        ),

        steam(
            `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${STEAM_API_KEY}&steamid=${steamId1}&relationship=friend`
        ),

        getProfileAge(steamId1)

    ]);

    let summary2 = { response: { players: [] } };
    let owned2 = { response: {} };
    let level2 = { response: {} };
    let badges2 = { response: {} };

    if (steamId2) {
        log("Fetching Steam data for Account 2...");
        const [
            summary2Raw,
            owned2Raw,
            level2Raw,
            badges2Raw
        ] = await Promise.all([
            steam(
                `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId2}`
            ),
            steam(
                `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId2}&include_appinfo=1&include_played_free_games=1`
            ),
            steam(
                `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${STEAM_API_KEY}&steamid=${steamId2}`
            ),
            steam(
                `https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=${STEAM_API_KEY}&steamid=${steamId2}`
            )
        ]);
        summary2 = summary2Raw;
        owned2 = owned2Raw;
        level2 = level2Raw;
        badges2 = badges2Raw;
    }

    log("Calculating statistics...");

    const player =
        summary.response.players?.[0];
    const player2 =
        summary2.response.players?.[0];

    // Account 1 (Main) Parsing
    const games1 = owned.response.games || [];
    const ownedGames1 = games1.length;
    const totalMinutes1 = games1.reduce(
        (sum, game) => sum + (game.playtime_forever || 0),
        0
    );
    const totalPlaytimeMs1 = totalMinutes1 * 60000;
    const steamLevel1 = level.response.player_level || 0;
    const xpProgress1 = calculateXpProgress(badges.response, steamLevel1);

    // Account 2 (CS) Parsing
    const games2 = owned2.response.games || [];
    const ownedGames2 = steamId2 ? games2.length : 0;
    const totalMinutes2 = games2.reduce(
        (sum, game) => sum + (game.playtime_forever || 0),
        0
    );
    const totalPlaytimeMs2 = totalMinutes2 * 60000;
    const steamLevel2 = level2.response.player_level || 0;
    const xpProgress2 = steamId2 
        ? calculateXpProgress(badges2.response, steamLevel2) 
        : "N/A";

    // CS2 Playtime (AppID 730) lookup (checks Account 2, falls back to Account 1)
    const cs2Game = games2.find(g => g.appid === 730) || games1.find(g => g.appid === 730);
    const cs2PlaytimeForever = cs2Game ? cs2Game.playtime_forever || 0 : 0;
    const cs2Hours = Math.round(cs2PlaytimeForever / 60);
    const cs2HoursString = `${cs2Hours.toLocaleString()} Hours`;

    // Display Name with spacing and divider
    const formattedDisplayName = steamId2 && player2
        ? `${player?.personaname || "Main"}   |   ${player2.personaname}`
        : (player?.personaname || "Unknown");

    // Console Summary

    log("-----------------------------");
    log(`User: ${formattedDisplayName}`);
    log(`Main Level: ${steamLevel1}`);
    log(`Main Games: ${ownedGames1}`);
    log(`Main Playtime: ${Math.round(totalMinutes1 / 60)} hours`);
    log(`Main Progress: ${xpProgress1}`);
    log(`CS Level: ${steamLevel2}`);
    log(`CS Games: ${ownedGames2}`);
    log(`CS Playtime: ${Math.round(totalMinutes2 / 60)} hours`);
    log(`CS Progress: ${xpProgress2}`);
    log(`CS2 Playtime: ${cs2HoursString}`);
    log(`Profile Age: ${profileAge}`);
    log("-----------------------------");

    log("Building widget payload...");

    const widget = {
        data: {
            dynamic: [
                {
                    type: 1,
                    name: "display_name",
                    value: formattedDisplayName
                },
                {
                    type: 1,
                    name: "xp_progress_1",
                    value: xpProgress1
                },
                {
                    type: 1,
                    name: "xp_progress_2",
                    value: xpProgress2
                },
                {
                    type: 1,
                    name: "cs2_hours",
                    value: cs2HoursString
                },
                {
                    type: 3,
                    name: "pfp",
                    value: {
                        url: player?.avatarfull || ""
                    }
                },
                {
                    type: 2,
                    name: "owned_games_1",
                    value: ownedGames1
                },
                {
                    type: 2,
                    name: "playtime_1",
                    value: totalPlaytimeMs1
                },
                {
                    type: 1,
                    name: "main_level",
                    value: `Lvl ${steamLevel1}`
                },
                {
                    type: 2,
                    name: "owned_games_2",
                    value: ownedGames2
                },
                {
                    type: 2,
                    name: "playtime_2",
                    value: totalPlaytimeMs2
                },
                {
                    type: 1,
                    name: "cs_level",
                    value: steamId2 ? `Lvl ${steamLevel2}` : "Lvl 0"
                }
            ]
        }
    };

    log("Widget preview:");
    console.log(JSON.stringify(widget, null, 2));

    await updateDiscordWidget(widget);

    log("Steam widget update completed successfully.");

}

main()
    .then(() => {
        log("Finished successfully.");
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
