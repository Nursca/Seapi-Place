export function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 16.5 L20 20.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 19.2c1.6-3 4-4.4 7-4.4s5.4 1.4 7 4.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconHeart({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function IconBag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 8h11l-.8 11h-9.4L6.5 8z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconTruck() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 7h11v8H2zM13 10h4l3 3v2h-7" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="17.5" r="1.4" stroke="currentColor" />
      <circle cx="17" cy="17.5" r="1.4" stroke="currentColor" />
    </svg>
  );
}

export function IconBox() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 8l9-4 9 4-9 4-9-4zM3 8v8l9 4 9-4V8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 12v8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconSeal() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.5 12.2l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function IconLock() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="10" width="12" height="9" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
