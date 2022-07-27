const token  = "AAAAAAAAAAAAAAAAAAAAAAHHcQEAAAAA%2FCm5fvh9%2B1c6INBeyxrLo7eXY1w%3DhW2tTWxksRnVV0Uwwqf7ZzIqT0CKvxvlURybuXVoPkNBg3CuWW";

var targetUser = document.getElementById('@user');
var userIdInput = document.getElementById('username');
var targetList = document.getElementById('list');
var targetStream = document.getElementById('stream');
var userName = document.getElementById("username").value;
var likes = document.getElementById("likes");
var tweetCount = document.getElementById("tweetCount");
var blocks = document.getElementById("blocks");
var followers = document.getElementById("followers");
var friends = document.getElementById("friends");
var mentions = document.getElementById("mentions");
var timeline = document.getElementById("timeline");
var tweets = document.getElementById("tweets");
var startDate = document.getElementById("start").value;
var endDate = document.getElementById("end").value;
var notIncludedWords = document.getElementById("!words").value;
var includedWords = document.getElementById("words").value;
var output = document.getElementById("output");


//events
function ShowHideDiv() { 
    var operations = document.getElementById("operations");
    var filters = document.getElementById("filters"); 
    operations.style.display = targetUser.checked ? "block" : "none";
    filters.style.display = targetStream.checked ? "block" : "none";
}
targetUser.addEventListener("click", ShowHideDiv);
targetStream.addEventListener("click", ShowHideDiv);

const needle = require('needle');

document.getElementById("dig").addEventListener("click", wordsSearch );
document.getElementById("dig").addEventListener("click", digIt);

async function digIt() {
    let newField = document.createElement("div")
    newField.setAttribute("id", "output")
    document.getElementById("outputFields").appendChild(newField);
    if (targetUser.checked) {
        var userID = await findUserId(userIdInput.value);
        getData(userID, newField);
        
         if (likes.checked) {
            likingUsers(userID);
        }

    }
    
    else if (targetStream.checked) {
        wordsSearch(newField);
    }
}

async function editURL(userId) {
    let gfparams = {
        "max_results": 20
    };
    let stringOption = "";
    if (followers.checked) {
        stringOption = "followers"
        return {"url" : `https://api.twitter.com/2/users/${userId}/${stringOption}`, "parameters": gfparams};
    }
    else if (blocks.checked) {
        stringOption = "blocking"
        return {"url" : `https://api.twitter.com/2/users/${userId}/${stringOption}`, "parameters": gfparams};
    }
    else if (timeline.checked) {
        return {"url" :`https://api.twitter.com/2/users/${userId}/timelines/reverse_chronological`, "parameters": gfparams};
    }
    else if (tweets.checked) {
        let params = {"query"  : `from:${userIdInput.value}`,
                      "tweet.fields" : "created_at",
                      "user.fields" : "created_at"};
        return {"url" :`https://api.twitter.com/2/tweets/search/recent`, 
                "parameters": params};
    }
    else if (tweetCount.checked) {
        let params = {"query" : `from:${userIdInput.value}`,
                      "granularity" : "day"};
        return {"url" : `https://api.twitter.com/2/tweets/counts/recent`, 
                "parameters": params};
    }
   
    else if (mentions.checked) {
        return {"url" :`https://api.twitter.com/2/users/${userId}/mentions`, "parameters": gfparams};
    }
    else if (friends.checked) {
        stringOption = "friends";
        return {"url" :`https://api.twitter.com/1.1/${stringOption}/ids.json?screen_name=${userIdInput.value}`, "parameters": gfparams};
    }
}

function splitWords(words){
    const rules = [];
    for (let i = 0; i < words.length; i++) {
        rules.push(setWordRule(words[i]));
    } 
    return rules;
}

function setWordRule(word){
    var rule = {
        'value': word,
        'tag': word 
    };
    return rule;
}

function wordsSearch(output) {
    if (includedWords.value !== "") {
            const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
            const streamURL = 'https://api.twitter.com/2/tweets/search/stream';        
            async function getAllRules() {            
                var respp = needle("get", rulesURL, {
                        headers: {
                            "authorization": `Bearer ${token}`                
                        }
                    });

                var response = await respp;

                if (response.statusCode !== 200) {
                    console.log("Error:", JSON.stringify(response));
                    throw new Error(response.body);
                }
                console.log(response.body);
                return (response.body);
            }

            async function deleteAllRules(rules) {
                if (!Array.isArray(rules.data)) {
                    return null;
                }
                const ids = rules.data.map(rule => rule.id);    
                const data = {
                    "delete": {
                        "ids": ids
                    }
                }
                const response = await needle("post", rulesURL, data, {
                        headers: {
                            "content-type": "application/json",
                            "authorization": `Bearer ${token}`
                        }

                    })

                if (response.statusCode !== 200) {
                    console.log("Error deleterules:", response.body);
                    throw new Error(response.body);
                }

                return (response.body);
            }

            async function setRules() {
                var includedWords = document.getElementById("words").value;
                var words = includedWords.trim().split(/\s+/);
                const rules = splitWords(words);
                console.log(JSON.stringify(rules));
                const data = { "add": rules }
                const response = await needle('post', rulesURL, data, {
                    headers: {
                        "content-type": "application/json",
                        "authorization": `Bearer ${token}`
                    }
                })

                if (response.statusCode !== 201) {
                    console.log("Error setRules:", response.body);
                    throw new Error(response.body);
                }
                return (response.body);
            }

            function streamConnect(retryAttempt) {
                const stream = needle.get(streamURL, {
                    headers: {
                        "User-Agent": "v2FilterStreamJS",
                        "Authorization": `Bearer ${token}`
                    },
                    timeout: 20000
                });

                stream.on('data', data => {
                    try {
                        const json = JSON.parse(data);
                        output.innerHTML= JSON.stringify(json); //(to check)
                        //console.log(json);
                        // A successful connection resets retry count.
                        retryAttempt = 0;
                    } catch (e) {
                        if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                            output.innerHTML = (data.detail);
                        } else {
                            // Keep alive signal received. Do nothing.
                        }
                    }
                    }).on('err', error => {
                        if (error.code !== 'ECONNRESET') {
                            output.innerHTML= error.code;
                            //console.log(error.code);
                        } else {
                            // This reconnection logic will attempt to reconnect when a disconnection is detected.
                            // To avoid rate limits, this logic implements exponential backoff, so the wait time
                            // will increase if the client cannot reconnect to the stream. 
                            setTimeout(() => {
                                console.warn("A connection error occurred. Reconnecting...")
                                streamConnect(++retryAttempt);
                            }, 2 ** retryAttempt)
                    }
                });

                return stream;
        }

        console.log("Connecting to stream...");
        (async function () {
            try {
                // Gets the complete list of rules currently applied to the stream
                console.log(`Getrules`);
                let currentRules = await getAllRules().catch((err) => { console.error(err); });
                
                if(currentRules !== undefined) {
                    // Delete all rules. Comment the line below if you want to keep your existing rules.
                    console.log(`Deleterules`);
                    await deleteAllRules(currentRules);
                }                

                // Add rules to the stream. Comment the line below if you don't want to add new rules.
                console.log(`Setrules`);
                await setRules();

            } catch (e) {
                console.error(JSON.stringify(e));
            }

            // Listen to the stream.
            console.log("call streamconnect");
            streamConnect(0);
        })();
        console.log("exit");
    }
}

const gbearerToken = "AAAAAAAAAAAAAAAAAAAAAAHHcQEAAAAA%2FCm5fvh9%2B1c6INBeyxrLo7eXY1w%3DhW2tTWxksRnVV0Uwwqf7ZzIqT0CKvxvlURybuXVoPkNBg3CuWW";
const gfoptions = {
    headers: {
        "User-Agent": "v2FollowersJS",
        "authorization": `Bearer ${gbearerToken}`
    }
};

async function findUserId(username) {     
    const un_url = `https://api.twitter.com/2/users/by/username/${username}`;
    console.log("Querying user id for username: "+ username + " url: " + un_url);
    try {
        const resp = await needle('get', un_url, gfoptions);

        if (resp.statusCode != 200) {
            console.log(JSON.stringify(resp.body));
            return;
        }
        console.log(`reply: `+JSON.stringify(resp.body));
        return resp.body.data.id == undefined ? -1 : resp.body.data.id;
    } catch (err) {
        throw new Error(`Request failed: ${err}`);
    }
}

async function getData(userId, dataField){
    var items = [];

    async function getPage(loptions, nextToken) {
        try {
            const url_p = await editURL(userId);
            if (nextToken) {
                url_p.parameters.pagination_token = nextToken;
            }
            console.log(url_p.url);
            console.log(JSON.stringify(url_p.parameters));
            const resp = await needle('get', url_p.url, url_p.parameters, loptions);
            
            if (resp.statusCode != 200) {
                console.log(JSON.stringify(resp.body));
                return;
            }
            return resp.body;
        } catch (err) {
            throw new Error(`Request failed: ${err}`);
        }
    }

    let hasNextPage = true;
    let nextToken = null;
    console.log("Retrieving data...");
    while (hasNextPage) {
        let resp = await getPage(gfoptions, nextToken);
        
        if (resp && resp.meta && resp.meta.result_count && resp.meta.result_count > 0) {
            if (resp.data) {
                items.push.apply(items, resp.data);
            }
            if (resp.meta.next_token) {
                nextToken = resp.meta.next_token;
                hasNextPage = false;
            } else {
                hasNextPage = false;
            }            
        } else if (resp?.meta?.total_tweet_count){
            items.push.apply(items, resp.data);
            hasNextPage = false;
        }
        else {
            hasNextPage = false;
            console.log(JSON.stringify(resp));
        }
    }

    dataField.innerHTML = JSON.stringify(items) + (` Got ${items.length} items.`);
}


async function likingUsers(userId){
const endpointURL = `https://api.twitter.com/2/tweets/${userId}/liking_users`;

async function getRequest() {
  // These are the parameters for the API request
  // by default, only the Tweet ID and text are returned
  const params = {
    "tweet.fields": "lang,author_id", // Edit optional query parameters here
    "user.fields": "created_at", // Edit optional query parameters here
  };

  // this is the HTTP header that adds bearer token authentication
  const res = await needle("get", endpointURL, params, {
    headers: {
      "User-Agent": "v2LikingUsersJS",
      authorization: `Bearer ${token}`
    },
  });

  if (res.body) {
    return res.body;
  } else {
    throw new Error("Unsuccessful request");
  }
}

(async () => {
  try {
    // Make request
    const response = await getRequest();
    output.innerHTML= JSON.stringify(response);
   
  } catch (e) {
    console.log(e);
  }
})();
        
}
