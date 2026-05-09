const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const carouselTrack = document.querySelector("[data-carousel-track]");
const nextButton = document.querySelector(".carousel-next");
const prevButton = document.querySelector(".carousel-prev");

if (carouselTrack && nextButton && prevButton) {
  const getStep = () => {
    const firstCard = carouselTrack.querySelector(".video-card");
    return firstCard ? firstCard.getBoundingClientRect().width + 16 : 236;
  };

  nextButton.addEventListener("click", () => {
    carouselTrack.scrollBy({ left: getStep() * 1.35, behavior: "smooth" });
  });

  prevButton.addEventListener("click", () => {
    carouselTrack.scrollBy({ left: -getStep() * 1.35, behavior: "smooth" });
  });
}

document.querySelectorAll(".faq-list details").forEach((detail) => {
  detail.addEventListener("toggle", () => {
    if (!detail.open) {
      return;
    }

    document.querySelectorAll(".faq-list details").forEach((other) => {
      if (other !== detail) {
        other.open = false;
      }
    });
  });
});
