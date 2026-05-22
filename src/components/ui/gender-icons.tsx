// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gender icons (Figma 7024:153938 / 7024:153936 / 7024:153943)
// ─────────────────────────────────────────────────────────────────────────────
//
// The gender-access symbols (Mars / Venus / all-gender) aren't part of
// @untitledui/icons, so they're hand-ported from the Figma asset SVGs here.
// Male + Female are 1.5px-stroked outline icons; All-gender is a filled glyph.
// All three inherit colour via `currentColor` so callers tint with text-*.

interface IconProps { className?: string }

export function GenderMale({ className }: IconProps) {
    return (
        <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M6.5 14C8.98528 14 11 11.9853 11 9.5C11 7.01472 8.98528 5 6.5 5C4.01472 5 2 7.01472 2 9.5C2 11.9853 4.01472 14 6.5 14Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.68164 6.31812L13.4998 2.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.5 2.5H13.5V5.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function GenderFemale({ className }: IconProps) {
    return (
        <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M8 10.5C10.4853 10.5 12.5 8.48528 12.5 6C12.5 3.51472 10.4853 1.5 8 1.5C5.51472 1.5 3.5 3.51472 3.5 6C3.5 8.48528 5.51472 10.5 8 10.5Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 10.5V15"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 13H10.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function GenderAll({ className }: IconProps) {
    return (
        <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M13 1.25H10.5C10.3011 1.25 10.1103 1.32902 9.96967 1.46967C9.82902 1.61032 9.75 1.80109 9.75 2C9.75 2.19891 9.82902 2.38968 9.96967 2.53033C10.1103 2.67098 10.3011 2.75 10.5 2.75H11.1875L10.21 3.72937C9.70947 3.31344 9.1201 3.01801 8.48734 2.86586C7.85459 2.71371 7.19534 2.70891 6.56043 2.85183C5.92552 2.99475 5.33192 3.28156 4.82538 3.69016C4.31885 4.09876 3.91291 4.61823 3.63888 5.20852C3.36485 5.79881 3.23004 6.44414 3.24484 7.09477C3.25965 7.7454 3.42368 8.38393 3.72427 8.96114C4.02487 9.53835 4.45402 10.0388 4.97861 10.424C5.50321 10.8091 6.10925 11.0686 6.75 11.1825V12H5.5C5.30109 12 5.11032 12.079 4.96967 12.2197C4.82902 12.3603 4.75 12.5511 4.75 12.75C4.75 12.9489 4.82902 13.1397 4.96967 13.2803C5.11032 13.421 5.30109 13.5 5.5 13.5H6.75V14.5C6.75 14.6989 6.82902 14.8897 6.96967 15.0303C7.11032 15.171 7.30109 15.25 7.5 15.25C7.69891 15.25 7.88968 15.171 8.03033 15.0303C8.17098 14.8897 8.25 14.6989 8.25 14.5V13.5H9.5C9.69891 13.5 9.88968 13.421 10.0303 13.2803C10.171 13.1397 10.25 12.9489 10.25 12.75C10.25 12.5511 10.171 12.3603 10.0303 12.2197C9.88968 12.079 9.69891 12 9.5 12H8.25V11.1825C8.92123 11.0628 9.55374 10.7831 10.094 10.3673C10.6344 9.9514 11.0665 9.41151 11.3541 8.79329C11.6416 8.17506 11.776 7.49668 11.7459 6.81552C11.7159 6.13436 11.5222 5.47047 11.1812 4.88L12.25 3.8125V4.5C12.25 4.69891 12.329 4.88968 12.4697 5.03033C12.6103 5.17098 12.8011 5.25 13 5.25C13.1989 5.25 13.3897 5.17098 13.5303 5.03033C13.671 4.88968 13.75 4.69891 13.75 4.5V2C13.75 1.80109 13.671 1.61032 13.5303 1.46967C13.3897 1.32902 13.1989 1.25 13 1.25ZM7.5 9.75C6.9561 9.75 6.42442 9.58871 5.97218 9.28654C5.51995 8.98437 5.16747 8.55488 4.95933 8.05238C4.75119 7.54988 4.69673 6.99695 4.80284 6.4635C4.90895 5.93005 5.17086 5.44005 5.55546 5.05546C5.94005 4.67086 6.43005 4.40895 6.9635 4.30284C7.49695 4.19673 8.04988 4.25119 8.55238 4.45933C9.05488 4.66747 9.48437 5.01995 9.78654 5.47218C10.0887 5.92442 10.25 6.4561 10.25 7C10.2492 7.72909 9.95918 8.42808 9.44363 8.94363C8.92808 9.45918 8.22909 9.74917 7.5 9.75Z"
                fill="currentColor" />
        </svg>
    );
}

/** Pick the gender icon for a class "Gender access" value
 *  ("All genders" / "Female only" / "Male only"). */
export function genderAccessIcon(gender: string, className?: string) {
    if (gender === "Male only")   return <GenderMale className={className} />;
    if (gender === "Female only") return <GenderFemale className={className} />;
    return <GenderAll className={className} />;
}
