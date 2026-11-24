
/* =========================================================
   LIONS HEART MAILI-NNE
   SENIOR TEAM MANAGEMENT HUB
   app.js
   ========================================================= */

(() => {
    "use strict";

    const STORAGE_KEY = "lionsHeartMailiNne_v1";

    const DEFAULT_MANAGER_PASSWORD = "Willy2026";
    const DEFAULT_STAFF_PASSWORD = "staff2026";

    const $ = id => document.getElementById(id);

    const todayISO = () => {
        const d = new Date();
        const local = new Date(
            d.getTime() - d.getTimezoneOffset() * 60000
        );
        return local.toISOString().slice(0, 10);
    };

    const escapeHTML = value =>
        String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char]));

    function defaultState() {
        return {
            managerPassword: DEFAULT_MANAGER_PASSWORD,
            staffPassword: DEFAULT_STAFF_PASSWORD,
            players: [],
            events: [],
            attendance: {},
            session: null
        };
    }

    function loadState() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );

            if (!saved || typeof saved !== "object") {
                return defaultState();
            }

            return {
                ...defaultState(),
                ...saved,
                players: Array.isArray(saved.players)
                    ? saved.players : [],
                events: Array.isArray(saved.events)
                    ? saved.events : [],
                attendance: saved.attendance || {}
            };

        } catch (error) {
            console.warn("Could not load saved data:", error);
            return defaultState();
        }
    }

    let state = loadState();
    let selectedEventId = null;
    let attendanceChart = null;

    function saveState() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(state)
            );
        } catch (error) {
            alert("Unable to save data in this browser.");
            console.error(error);
        }
    }

    function currentUser() {
        return state.session;
    }

    function isManager() {
        return currentUser()?.role === "manager";
    }

    function show(element, visible) {
        if (element) {
            element.classList.toggle("hidden", !visible);
        }
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value;
    }

    function notify(message) {
        let toast = $("appToast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "appToast";

            Object.assign(toast.style, {
                position: "fixed",
                right: "18px",
                bottom: "18px",
                zIndex: "9999",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "#202020",
                color: "#fff",
                boxShadow: "0 8px 28px rgba(0,0,0,.25)",
                transition: "opacity .2s ease"
            });

            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = "1";

        clearTimeout(notify.timer);

        notify.timer = setTimeout(() => {
            toast.style.opacity = "0";
        }, 2600);
    }

    function makeId() {
        return Date.now().toString(36) +
            Math.random().toString(36).slice(2, 9);
    }

    function getPlayerById(id) {
        return state.players.find(player => player.id === id);
    }

    function attendanceFor(eventId) {
        if (!state.attendance[eventId]) {
            state.attendance[eventId] = [];
        }

        return state.attendance[eventId];
    }

    function formatDate(isoDate) {
        if (!isoDate) return "";

        return new Date(isoDate + "T12:00:00")
            .toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            });
    }

    // =====================================================
    // LOGIN SYSTEM
    // =====================================================

    window.updateLoginFields = function () {

        const role = $("loginRole")?.value || "manager";

        show(
            $("playerSelectContainer"),
            role === "player"
        );

        setText(
            "passwordLabel",
            role === "manager"
                ? "Manager Password"
                : role === "player"
                    ? "Player Password"
                    : "Support Staff Password"
        );

        const hint = $("loginHint");

        if (hint) {
            hint.textContent =
                role === "manager"
                    ? 'Must start with "Willy" (Default: Willy2026)'
                    : role === "player"
                    
        }

        const playerSelect = $("loginPlayerName");

        if (playerSelect) {
            playerSelect.innerHTML = state.players.length
                ? state.players.map(p => `
                    <option value="${escapeHTML(p.id)}">
                        ${escapeHTML(p.name)} — #${escapeHTML(p.jersey)}
                    </option>
                `).join("")
                : '<option value="">No players added yet</option>';
        }
    };

    window.handleLogin = function (event) {

        event.preventDefault();

        const role = $("loginRole").value;
        const password = $("loginPassword").value;

        let session = null;
        let message = "";

        if (role === "manager") {

            if (password === state.managerPassword) {
                session = {
                    role: "manager",
                    name: "Head Manager / Coach"
                };
            } else {
                message = "Incorrect manager password.";
            }

        } else if (role === "staff") {

            if (password === state.staffPassword) {
                session = {
                    role: "staff",
                    name: "Support Staff"
                };
            } else {
                message = "Incorrect staff password.";
            }

        } else {

            const player = getPlayerById(
                $("loginPlayerName").value
            );

            if (!player) {
                message = "No player account found.";
            } else if (password === player.password) {
                session = {
                    role: "player",
                    name: player.name,
                    playerId: player.id
                };
            } else {
                message = "Incorrect player password.";
            }
        }

        if (!session) {
            const error = $("loginError");

            if (error) {
                error.textContent = message;
                show(error, true);
            } else {
                alert(message);
            }

            return;
        }

        state.session = session;
        saveState();

        show($("loginError"), false);
        show($("authOverlay"), false);
        show($("mainApp"), true);

        $("loginPassword").value = "";

        applyRoleAccess();
        renderAll();
    };

    window.logout = function () {

        state.session = null;

        saveState();

        show($("mainApp"), false);
        show($("authOverlay"), true);

        $("loginForm")?.reset();

        window.updateLoginFields();
    };

    // =====================================================
    // USER PERMISSIONS
    // =====================================================

    function applyRoleAccess() {

        const user = currentUser();

        if (!user) return;

        const manager = user.role === "manager";
        const player = user.role === "player";

        setText("navUserName", user.name);

        setText(
            "navUserRoleBadge",
            manager ? "Full Access" :
            player ? "Player Access" :
            "Support Staff"
        );

        show($("tab-settings"), manager);

        show($("managerNewEventBtn"), manager);
        show($("managerAddPlayerBtn"), manager);

        show($("passwordSection"), manager);
        show($("nonManagerNote"), !manager);

        show($("playerSpecificCard"), player);

        setText(
            "squadTabLabel",
            manager ? "Squad Roster & Sign-ins" : "Squad Roster"
        );

        if (player) {

            const p = getPlayerById(user.playerId);

            if (p) {
                setText(
                    "playerRolePositionBadge",
                    `${p.position} #${p.jersey}`
                );

                setText(
                    "myTechRating",
                    `${Number(p.technical).toFixed(1)} / 5.0`
                );

                setText(
                    "myPhysRating",
                    `${Number(p.physical).toFixed(1)} / 5.0`
                );

                setText(
                    "myTacRating",
                    `${Number(p.tactical).toFixed(1)} / 5.0`
                );

                setText(
                    "myCoachNotes",
                    p.notes || "No feedback available."
                );
            }
        }
    }

    // =====================================================
    // NAVIGATION
    // =====================================================

    window.switchTab = function (tabName) {

        const tabs = [
            "dashboard",
            "calendar",
            "squad",
            "settings"
        ];

        if (!tabs.includes(tabName)) return;

        if (tabName === "settings" && !isManager()) {
            notify("Only the manager can open settings.");
            return;
        }

        tabs.forEach(tab => {

            show(
                $(`content-${tab}`),
                tab === tabName
            );

            const button = $(`tab-${tab}`);

            if (button) {
                button.classList.toggle(
                    "active",
                    tab === tabName
                );
            }
        });

        if (tabName === "dashboard") renderDashboard();
        if (tabName === "calendar") renderCalendar();
        if (tabName === "squad") renderRoster();
    };

    // =====================================================
    // DASHBOARD
    // =====================================================

    function renderDashboard() {

        const playerCount = state.players.length;

        const totalPossible =
            state.events.length * playerCount;

        const totalPresent = state.events.reduce(
            (sum, event) =>
                sum + attendanceFor(event.id).length,
            0
        );

        const attendanceRate = totalPossible
            ? Math.round(
                totalPresent / totalPossible * 100
            )
            : 0;

        const morale = playerCount
            ? (
                state.players.reduce(
                    (sum, p) =>
                        sum +
                        (
                            Number(p.technical) +
                            Number(p.physical) +
                            Number(p.tactical)
                        ) / 3,
                    0
                ) / playerCount
            ).toFixed(1)
            : "0.0";

        setText("statSquadCount", playerCount);
        setText("statAttendanceRate", attendanceRate + "%");
        setText("statMorale", morale + "/5");

        const user = currentUser();

        setText(
            "welcomeTitle",
            user?.role === "player"
                ? `Welcome, ${user.name}`
                : "Welcome Back, Coach"
        );

        renderTopBadges();
        renderAttendanceChart();

        if (user?.role === "player") {
            applyRoleAccess();
        }
    }

    function attendanceScore(playerId) {

        return state.events.reduce(
            (sum, event) =>
                sum +
                (
                    attendanceFor(event.id).includes(playerId)
                        ? 10
                        : 0
                ),
            0
        );
    }

    function renderTopBadges() {

        const container = $("topBadgesList");

        if (!container) return;

        const sorted = [...state.players]
            .sort((a, b) =>
                attendanceScore(b.id) - attendanceScore(a.id)
            )
            .slice(0, 5);

        if (!sorted.length) {
            container.innerHTML =
                '<p class="hint">No players registered yet.</p>';
            return;
        }

        container.innerHTML = sorted.map((p, index) => `
            <div class="mini-row">
                <span>
                    <strong>${index + 1}. ${escapeHTML(p.name)}</strong>
                    <br>
                    <small>${escapeHTML(p.badge || "Team Player")}</small>
                </span>

                <span class="tag">
                    ${attendanceScore(p.id)} pts
                </span>
            </div>
        `).join("");
    }

    function renderAttendanceChart() {

        const canvas = $("attendanceChart");

        if (!canvas || typeof Chart === "undefined") return;

        const labels = [];
        const values = [];

        for (let i = 3; i >= 0; i--) {

            labels.push(`Week ${4 - i}`);

            const start = new Date();
            start.setDate(start.getDate() - (i * 7 + 6));

            const end = new Date();
            end.setDate(end.getDate() - i * 7);

            const events = state.events.filter(event => {
                const date = new Date(event.date + "T12:00:00");
                return date >= start && date <= end;
            });

            const possible = events.length * state.players.length;

            const present = events.reduce(
                (sum, event) =>
                    sum + attendanceFor(event.id).length,
                0
            );

            values.push(
                possible
                    ? Math.round(present / possible * 100)
                    : 0
            );
        }

        if (attendanceChart) {
            attendanceChart.destroy();
        }

        attendanceChart = new Chart(canvas, {
            type: "line",

            data: {
                labels,

                datasets: [{
                    label: "Attendance (%)",
                    data: values,
                    borderColor: "#d6a843",
                    backgroundColor: "rgba(214,168,67,.15)",
                    fill: true,
                    tension: 0.35
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                },

                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // =====================================================
    // CALENDAR AND EVENTS
    // =====================================================

    window.openNewEventModal = function () {

        if (!isManager()) {
            notify("Only the manager can schedule activities.");
            return;
        }

        $("eventForm")?.reset();

        if ($("modalEventDate")) {
            $("modalEventDate").value = todayISO();
        }

        show($("eventModal"), true);
    };

    window.closeEventModal = function () {
        show($("eventModal"), false);
    };

    window.saveNewEvent = function (event) {

        event.preventDefault();

        if (!isManager()) return;

        const title = $("modalEventTitle").value.trim();
        const type = $("modalEventType").value;
        const date = $("modalEventDate").value;

        if (!title || !date) {
            notify("Enter the activity title and date.");
            return;
        }

        const newEvent = {
            id: makeId(),
            title,
            type,
            date
        };

        state.events.push(newEvent);

        state.events.sort(
            (a, b) => a.date.localeCompare(b.date)
        );

        selectedEventId = newEvent.id;

        saveState();

        window.closeEventModal();

        renderAll();
        window.switchTab("calendar");

        notify("Activity successfully scheduled.");
    };

    function renderCalendar() {

        const list = $("calendarEventsList");

        if (!list) return;

        const events = [...state.events].sort(
            (a, b) => a.date.localeCompare(b.date)
        );

        if (!events.length) {

            list.innerHTML =
                '<p class="hint">No activities scheduled yet.</p>';

            selectedEventId = null;

            renderSelectedEvent();

            return;
        }

        if (!events.some(e => e.id === selectedEventId)) {
            selectedEventId = events[0].id;
        }

        list.innerHTML = events.map(event => `
            <button
                type="button"
                class="event-list-item ${event.id === selectedEventId ? "active" : ""}"
                data-event-id="${escapeHTML(event.id)}"
            >
                <strong>${escapeHTML(event.title)}</strong>

                <span class="hint">
                    ${formatDate(event.date)} · ${escapeHTML(event.type)}
                </span>
            </button>
        `).join("");

        list.querySelectorAll("[data-event-id]")
            .forEach(button => {

                button.addEventListener("click", () => {

                    selectedEventId = button.dataset.eventId;

                    renderCalendar();
                });
            });

        renderSelectedEvent();
    }

    function renderSelectedEvent() {

        const event = state.events.find(
            item => item.id === selectedEventId
        );

        const grid = $("tapAttendanceGrid");

        if (!event) {

            setText("activeEventDateBadge", "Select a Date");
            setText("activeEventTitle", "No Activity Selected");
            setText("activeEventAttendanceCount", "0 Attended");

            if (grid) {
                grid.innerHTML =
                    '<p class="hint">Schedule an activity first.</p>';
            }

            return;
        }

        const present = attendanceFor(event.id);

        setText(
            "activeEventDateBadge",
            formatDate(event.date)
        );

        setText("activeEventTitle", event.title);

        setText(
            "activeEventAttendanceCount",
            `${present.length} / ${state.players.length} Attended`
        );

        if (!grid) return;

        if (!state.players.length) {

            grid.innerHTML =
                '<p class="hint">Add players before recording attendance.</p>';

            return;
        }

        const canTap = ["manager", "staff"].includes(
            currentUser()?.role
        );

        grid.innerHTML = state.players.map(player => {

            const isPresent = present.includes(player.id);

            return `
                <button
                    type="button"
                    class="attendance-player ${isPresent ? "present" : ""}"
                    data-player-id="${escapeHTML(player.id)}"
                    ${canTap ? "" : "disabled"}
                >
                    <span>
                        <strong>${escapeHTML(player.name)}</strong>
                        <br>
                        <small>
                            #${escapeHTML(player.jersey)}
                            · ${escapeHTML(player.position)}
                        </small>
                    </span>

                    <span>
                        ${isPresent ? "✓ Present" : "Tap to mark present"}
                    </span>
                </button>
            `;
        }).join("");

        if (canTap) {

            grid.querySelectorAll("[data-player-id]")
                .forEach(button => {

                    button.addEventListener("click", () => {

                        toggleAttendance(
                            event.id,
                            button.dataset.playerId
                        );
                    });
                });
        }
    }

    function toggleAttendance(eventId, playerId) {

        if (!["manager", "staff"].includes(currentUser()?.role)) {
            return;
        }

        const list = attendanceFor(eventId);

        const index = list.indexOf(playerId);

        if (index >= 0) {
            list.splice(index, 1);
        } else {
            list.push(playerId);
        }

        saveState();

        renderCalendar();
        renderDashboard();
    }

    // =====================================================
    // PLAYER MANAGEMENT
    // =====================================================

    window.openAddPlayerModal = function () {

        if (!isManager()) {
            notify("Only the manager can add players.");
            return;
        }

        $("playerForm")?.reset();

        setText("playerModalTitle", "Sign In New Player");

        $("editPlayerIndex").value = "-1";

        $("modalPlayerPosition").value = "FWD";
        $("modalPlayerJersey").value = "10";

        $("modalTech").value = "4.0";
        $("modalPhys").value = "4.0";
        $("modalTac").value = "4.0";

        $("modalPlayerNotes").value =
            "Keep up the high work rate in training.";

        show($("playerModal"), true);
    };

    window.closePlayerModal = function () {
        show($("playerModal"), false);
    };

    function clampRating(value) {

        const number = Number(value);

        return Math.min(
            5,
            Math.max(
                1,
                Number.isFinite(number) ? number : 1
            )
        );
    }

    window.savePlayer = function (event) {

        event.preventDefault();

        if (!isManager()) return;

        const editIndex = Number(
            $("editPlayerIndex").value
        );

        const name = $("modalPlayerName").value.trim();
        const password = $("modalPlayerPassword").value.trim();
        const jersey = Number($("modalPlayerJersey").value);

        if (
            !name ||
            !password ||
            !Number.isInteger(jersey) ||
            jersey < 1 ||
            jersey > 99
        ) {
            notify("Enter a valid player name, password and jersey number.");
            return;
        }

        const duplicate = state.players.findIndex(
            (p, index) =>
                Number(p.jersey) === jersey &&
                index !== editIndex
        );

        if (duplicate !== -1) {
            notify("That jersey number is already assigned.");
            return;
        }

        const player = {

            id: editIndex >= 0
                ? state.players[editIndex].id
                : makeId(),

            name,

            position: $("modalPlayerPosition").value,

            jersey,

            password,

            technical: clampRating($("modalTech").value),

            physical: clampRating($("modalPhys").value),

            tactical: clampRating($("modalTac").value),

            badge: $("modalPlayerBadge").value,

            notes: $("modalPlayerNotes").value.trim()
        };

        if (editIndex >= 0 && state.players[editIndex]) {
            state.players[editIndex] = player;
        } else {
            state.players.push(player);
        }

        saveState();

        window.closePlayerModal();

        window.updateLoginFields();

        renderAll();

        notify("Player information saved successfully.");
    };

    function renderRoster() {

        const body = $("rosterTableBody");

        if (!body) return;

        if (!state.players.length) {

            body.innerHTML = `
                <tr>
                    <td colspan="8" class="hint">
                        No players have been added yet.
                    </td>
                </tr>
            `;

            return;
        }

        const manager = isManager();

        body.innerHTML = state.players.map(player => `

            <tr>

                <td>
                    <strong>${escapeHTML(player.name)}</strong>
                    <br>
                    <small>${escapeHTML(player.badge || "")}</small>
                </td>

                <td>${escapeHTML(player.position)}</td>

                <td>${escapeHTML(player.jersey)}</td>

                <td>
                    ${manager
                        ? escapeHTML(player.password)
                        : "••••••••"}
                </td>

                <td>${Number(player.technical).toFixed(1)}</td>

                <td>${Number(player.physical).toFixed(1)}</td>

                <td>${Number(player.tactical).toFixed(1)}</td>

                <td class="center">

                    ${manager ? `

                        <button
                            type="button"
                            class="btn btn-outline btn-small"
                            data-edit-player="${escapeHTML(player.id)}"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="btn btn-dark btn-small"
                            data-delete-player="${escapeHTML(player.id)}"
                        >
                            Delete
                        </button>

                    ` : "—"}

                </td>

            </tr>

        `).join("");

        body.querySelectorAll("[data-edit-player]")
            .forEach(button => {

                button.addEventListener("click", () => {
                    editPlayer(button.dataset.editPlayer);
                });
            });

        body.querySelectorAll("[data-delete-player]")
            .forEach(button => {

                button.addEventListener("click", () => {
                    deletePlayer(button.dataset.deletePlayer);
                });
            });
    }

    function editPlayer(id) {

        if (!isManager()) return;

        const index = state.players.findIndex(
            p => p.id === id
        );

        const p = state.players[index];

        if (!p) return;

        setText("playerModalTitle", "Edit Player Details");

        $("editPlayerIndex").value = index;

        $("modalPlayerName").value = p.name;
        $("modalPlayerPosition").value = p.position;
        $("modalPlayerJersey").value = p.jersey;
        $("modalPlayerPassword").value = p.password;

        $("modalTech").value = p.technical;
        $("modalPhys").value = p.physical;
        $("modalTac").value = p.tactical;

        $("modalPlayerBadge").value = p.badge;

        $("modalPlayerNotes").value = p.notes || "";

        show($("playerModal"), true);
    }

    function deletePlayer(id) {

        if (!isManager()) return;

        const player = getPlayerById(id);

        if (!player) return;

        const confirmed = confirm(
            `Delete ${player.name} from the squad?`
        );

        if (!confirmed) return;

        state.players = state.players.filter(
            p => p.id !== id
        );

        Object.keys(state.attendance).forEach(eventId => {

            state.attendance[eventId] =
                state.attendance[eventId].filter(
                    playerId => playerId !== id
                );
        });

        if (state.session?.playerId === id) {
            state.session = null;
        }

        saveState();

        window.updateLoginFields();

        if (!state.session) {
            window.logout();
        } else {
            renderAll();
        }

        notify("Player deleted.");
    }

    // =====================================================
    // MANAGER PASSWORD SETTINGS
    // =====================================================

    window.handlePasswordChange = function (event) {

        event.preventDefault();

        if (!isManager()) return;

        const current = $("currentPassInput").value;
        const next = $("newPassInput").value;

        const error = $("passwordChangeError");
        const success = $("passwordChangeSuccess");

        show(error, false);
        show(success, false);

        let message = "";

        if (current !== state.managerPassword) {

            message = "The current password is incorrect.";

        } else if (!next.startsWith("Willy") || next.length < 7) {

            message = 'New password must start with "Willy" and have at least 7 characters.';

        } else if (next === current) {

            message = "Choose a different password.";
        }

        if (message) {

            if (error) {
                error.textContent = message;
                show(error, true);
            } else {
                notify(message);
            }

            return;
        }

        state.managerPassword = next;

        saveState();

        $("currentPassInput").value = "";
        $("newPassInput").value = "";

        if (success) {

            success.textContent =
                "Manager password updated successfully.";

            show(success, true);

        } else {

            notify("Manager password updated.");
        }
    };

    // =====================================================
    // RENDER EVERYTHING
    // =====================================================

    function renderAll() {

        applyRoleAccess();

        renderDashboard();

        renderCalendar();

        renderRoster();

        window.updateLoginFields();
    }

    // =====================================================
    // START APPLICATION
    // =====================================================

    function init() {

        window.updateLoginFields();

        if ($("loginRole")) {
            $("loginRole").value = "manager";
        }

        window.updateLoginFields();

        if (state.session) {

            show($("authOverlay"), false);
            show($("mainApp"), true);

            renderAll();

        } else {

            show($("authOverlay"), true);
            show($("mainApp"), false);
        }

        // Close modal when clicking outside its content.

        ["playerModal", "eventModal"].forEach(id => {

            const overlay = $(id);

            overlay?.addEventListener("click", event => {

                if (event.target === overlay) {
                    show(overlay, false);
                }
            });
        });
    }

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

})();
