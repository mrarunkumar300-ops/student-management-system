// =========================================
// LIGHT / NIGHT MODE
// =========================================

document.addEventListener("DOMContentLoaded", function () {

    // Create toggle button
    const button = document.createElement("button");

    button.className = "theme-toggle-btn";
    button.type = "button";

    document.body.appendChild(button);


    // Check saved theme
    const savedTheme =
        localStorage.getItem("theme");


    if (savedTheme === "dark") {

        document.body.classList.add(
            "dark-mode"
        );

        button.textContent = "☀️";

    } else {

        button.textContent = "🌙";
    }


    // Toggle theme
    button.addEventListener(
        "click",
        function () {

            document.body.classList.toggle(
                "dark-mode"
            );


            const isDark =
                document.body.classList.contains(
                    "dark-mode"
                );


            if (isDark) {

                button.textContent = "☀️";

                localStorage.setItem(
                    "theme",
                    "dark"
                );

            } else {

                button.textContent = "🌙";

                localStorage.setItem(
                    "theme",
                    "light"
                );
            }

        }
    );

});