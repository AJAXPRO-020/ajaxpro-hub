const nextMatchBanner = document.querySelector("[data-next-match]");

const homeProgram = document.querySelector("[data-home-program]");
if (homeProgram) {
  window.fetch("/api/next-match?view=program", { headers: { Accept: "application/json" } })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((payload) => {
      const upcoming = payload.fixtures?.slice(0, 3) || [];
      homeProgram.textContent = upcoming.length
        ? `${upcoming.length} komende ${upcoming.length === 1 ? "wedstrijd" : "wedstrijden"} bekijken`
        : "Het programma wordt binnenkort bekendgemaakt.";
    })
    .catch(() => { homeProgram.textContent = "Bekijk het actuele programma."; });
}

if (nextMatchBanner) {
  const teamsField = nextMatchBanner.querySelector("[data-match-teams]");
  const metaField = nextMatchBanner.querySelector("[data-match-meta]");
  const tvField = nextMatchBanner.querySelector("[data-match-tv]");
  const stateField = nextMatchBanner.querySelector("[data-match-state]");
  const clockField = nextMatchBanner.querySelector("[data-match-clock]");
  const cacheKey = "ajaxpro-next-match";
  let currentPayload;
  let countdownTimer;
  let refreshTimer;
  let refreshInFlight = false;

  const scheduleRefresh = (delay) => {
    window.clearTimeout(refreshTimer);
    if (document.hidden) return;
    refreshTimer = window.setTimeout(loadMatchday, delay);
  };

  const formatCountdown = (kickoff) => {
    const remaining = Math.max(0, kickoff.getTime() - Date.now());
    const totalMinutes = Math.floor(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    return `${String(days).padStart(2, "0")}D ${String(hours).padStart(2, "0")}U ${String(minutes).padStart(2, "0")}M`;
  };

  const startCountdown = (kickoff) => {
    window.clearInterval(countdownTimer);
    const update = () => {
      clockField.textContent = formatCountdown(kickoff);
      if (kickoff.getTime() <= Date.now()) {
        window.clearInterval(countdownTimer);
        stateField.textContent = "Live";
        clockField.textContent = "AFTRAP";
        loadMatchday();
      }
    };
    update();
    countdownTimer = window.setInterval(update, 1000);
  };

  const renderNextMatch = (payload) => {
    if (!payload?.match) {
      window.clearInterval(countdownTimer);
      nextMatchBanner.hidden = true;
      return;
    }

    currentPayload = payload;
    const kickoff = new Date(payload.match.kickoff);
    const date = new Intl.DateTimeFormat("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Amsterdam",
    }).format(kickoff);
    const time = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    }).format(kickoff);

    const live = payload.match.mode === "live";
    teamsField.textContent = live
      ? `${payload.match.home} ${payload.match.score?.home ?? 0} – ${payload.match.score?.away ?? 0} ${payload.match.away}`
      : `${payload.match.home} – ${payload.match.away}`;
    metaField.textContent = `${date} · ${time} · ${payload.match.competition}`;
    tvField.textContent = payload.match.tv || "Zender nog niet bekend";
    nextMatchBanner.hidden = false;
    nextMatchBanner.classList.toggle("is-live", live);
    nextMatchBanner.classList.remove("is-loading", "is-unavailable");
    if (live) {
      window.clearInterval(countdownTimer);
      stateField.textContent = "Live";
      clockField.textContent = payload.match.isBreak ? "RUST" : payload.match.minute != null ? `${payload.match.minute}'` : "NU";
      scheduleRefresh(20000);
    } else {
      stateField.textContent = "Aftrap over";
      startCountdown(kickoff);
      scheduleRefresh(Math.min(5 * 60000, Math.max(15000, kickoff.getTime() - Date.now())));
    }
  };

  function loadMatchday() {
    window.clearTimeout(refreshTimer);
    if (document.hidden || refreshInFlight) return Promise.resolve();
    refreshInFlight = true;
    return window.fetch("/api/next-match", { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Next match returned ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        renderNextMatch(payload);
        window.localStorage.setItem(cacheKey, JSON.stringify(payload));
      })
      .catch(() => {
        if (currentPayload?.match) {
          scheduleRefresh(currentPayload.match.mode === "live" ? 60000 : 5 * 60000);
          return;
        }
        nextMatchBanner.hidden = true;
      })
      .finally(() => {
        refreshInFlight = false;
      });
  }

  document.addEventListener("visibilitychange", () => {
    window.clearTimeout(refreshTimer);
    if (!document.hidden) loadMatchday();
  });

  try {
    const cachedMatch = JSON.parse(window.localStorage.getItem(cacheKey));
    if (cachedMatch?.match) renderNextMatch(cachedMatch);
  } catch {
    window.localStorage.removeItem(cacheKey);
  }

  loadMatchday();
}

const youtubeCard = document.querySelector(".youtube-card");

if (youtubeCard) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frameId = 0;
  let currentY = 0;
  const targetY = 150;
  const easing = 0.012;

  const render = () => {
    currentY += (targetY - currentY) * easing;
    youtubeCard.style.setProperty("--youtube-preview-y", `${currentY}px`);

    if (Math.abs(targetY - currentY) > 0.5) {
      frameId = window.requestAnimationFrame(render);
    }
  };

  const stopPreview = () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  youtubeCard.addEventListener("mouseenter", () => {
    youtubeCard.classList.add("is-preview-active");
    if (reduceMotion.matches) {
      return;
    }

    stopPreview();
    frameId = window.requestAnimationFrame(render);
  });

  youtubeCard.addEventListener("mouseleave", () => {
    youtubeCard.classList.remove("is-preview-active");
    stopPreview();
  });
}

const discordTransferCard = document.querySelector(".discord-transfer-card");

if (discordTransferCard) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const chatMessages = [
    "Godts blijft toch?",
    "Nieuwe naam uit Frankrijk.",
    "Bron lijkt betrouwbaar.",
    "Zet maar in transferpraat.",
  ];
  const chatDirections = ["right", "left", "right", "left"];
  const chatLayer = discordTransferCard.querySelector(".discord-card__chat");
  let chatTimer = 0;
  let chatIndex = 0;

  const captureMessagePositions = () =>
    new Map(
      [...chatLayer.querySelectorAll(".discord-card__message")].map((message) => [
        message,
        message.getBoundingClientRect().top,
      ]),
    );

  const animateMessageShift = (positions) => {
    if (reduceMotion.matches) {
      return;
    }

    chatLayer.querySelectorAll(".discord-card__message").forEach((message) => {
      const previousTop = positions.get(message);

      if (previousTop === undefined) {
        return;
      }

      const delta = previousTop - message.getBoundingClientRect().top;

      if (Math.abs(delta) < 1) {
        return;
      }

      message.animate(
        [
          { transform: `translateY(${delta}px) scale(1)` },
          { transform: "translateY(0) scale(1)" },
        ],
        {
          duration: 520,
          easing: "cubic-bezier(0.18, 0.9, 0.22, 1)",
        },
      );
    });
  };

  const clearChat = () => {
    window.clearInterval(chatTimer);
    chatTimer = 0;
    chatIndex = 0;
    chatLayer.replaceChildren();
    discordTransferCard.classList.remove("is-chatting");
  };

  const addChatMessage = () => {
    const previousPositions = captureMessagePositions();
    const message = document.createElement("span");
    const direction = chatDirections[chatIndex % chatDirections.length];

    message.className = `discord-card__message discord-card__message--${direction}`;
    message.textContent = chatMessages[chatIndex % chatMessages.length];
    chatLayer.append(message);

    window.requestAnimationFrame(() => {
      animateMessageShift(previousPositions);
      message.classList.add("is-visible");
    });

    const messages = chatLayer.querySelectorAll(".discord-card__message");
    if (messages.length > 3) {
      const oldestMessage = messages[0];
      oldestMessage.classList.add("is-exiting");
      window.setTimeout(() => {
        oldestMessage.remove();
      }, reduceMotion.matches ? 0 : 560);
    }

    chatIndex += 1;
  };

  const startChat = () => {
    discordTransferCard.classList.add("is-chatting");
    window.clearInterval(chatTimer);
    chatLayer.replaceChildren();
    chatIndex = 0;

    window.setTimeout(() => {
      if (!discordTransferCard.classList.contains("is-chatting")) {
        return;
      }

      addChatMessage();
      chatTimer = window.setInterval(addChatMessage, reduceMotion.matches ? 1000 : 760);
    }, reduceMotion.matches ? 0 : 300);
  };

  discordTransferCard.addEventListener("mouseenter", startChat);
  discordTransferCard.addEventListener("mouseleave", clearChat);
  discordTransferCard.addEventListener("blur", clearChat);
}

const faqItems = document.querySelectorAll(".faq details");

faqItems.forEach((details) => {
  const summary = details.querySelector("summary");
  const answer = details.querySelector("p");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let targetOpen = details.open;
  let detailsAnimation;
  let answerAnimation;
  let keyboardTriggered = false;

  if (!summary || !answer) {
    return;
  }

  summary.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      keyboardTriggered = true;
    }
  });

  summary.addEventListener("click", (event) => {
    event.preventDefault();
    targetOpen = !targetOpen;
    detailsAnimation?.cancel();
    answerAnimation?.cancel();

    if (keyboardTriggered) {
      keyboardTriggered = false;
      details.classList.add("is-keyboard-toggle");
      details.style.removeProperty("overflow");
      details.open = targetOpen;
      window.requestAnimationFrame(() => {
        details.classList.remove("is-keyboard-toggle");
      });
      return;
    }

    const startHeight = details.getBoundingClientRect().height;

    if (targetOpen) {
      details.open = true;
    }

    const duration = reduceMotion.matches ? 100 : targetOpen ? 220 : 180;
    const translateY = reduceMotion.matches ? "0" : "-8px";
    const frames = targetOpen
      ? [
          { opacity: 0, transform: `translateY(${translateY})` },
          { opacity: 1, transform: "translateY(0)" },
        ]
      : [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: `translateY(${translateY})` },
        ];

    answerAnimation = answer.animate(frames, {
      duration,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });

    if (!reduceMotion.matches) {
      const borderWidth = Number.parseFloat(getComputedStyle(details).borderBottomWidth) || 0;
      const endHeight = targetOpen
        ? details.getBoundingClientRect().height
        : summary.getBoundingClientRect().height + borderWidth;

      details.style.overflow = "hidden";
      detailsAnimation = details.animate(
        [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
        {
          duration,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        },
      );

      const currentDetailsAnimation = detailsAnimation;
      currentDetailsAnimation.addEventListener("finish", () => {
        if (detailsAnimation !== currentDetailsAnimation) {
          return;
        }

        if (!targetOpen) {
          details.open = false;
        }
        details.style.removeProperty("overflow");
        detailsAnimation = undefined;
      });
    }

    answerAnimation.addEventListener("finish", () => {
      if (reduceMotion.matches && !targetOpen) {
        details.open = false;
      }
      answerAnimation = undefined;
    });
  });
});
