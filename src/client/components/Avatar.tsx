import type { ReactNode } from 'react';
import { AVATAR_NAMES, AvatarKind } from '../../shared/protocol';

const faces: Record<AvatarKind, ReactNode> = {
  kucing: (
    <>
      <circle cx="50" cy="50" r="50" fill="#FCD9A8" />
      <polygon points="22,42 28,12 46,30" fill="#E8893A" />
      <polygon points="78,42 72,12 54,30" fill="#E8893A" />
      <polygon points="27,34 30,20 38,30" fill="#F7B7A3" />
      <polygon points="73,34 70,20 62,30" fill="#F7B7A3" />
      <circle cx="50" cy="56" r="30" fill="#E8893A" />
      <ellipse cx="50" cy="68" rx="16" ry="11" fill="#FFF3E2" />
      <g className="av-eyes">
        <circle cx="39" cy="53" r="5" fill="#2E2118" />
        <circle cx="61" cy="53" r="5" fill="#2E2118" />
        <circle cx="40.6" cy="51.2" r="1.7" fill="#fff" />
        <circle cx="62.6" cy="51.2" r="1.7" fill="#fff" />
      </g>
      <path d="M46 62 L54 62 L50 66 Z" fill="#D9536B" />
      <circle cx="29" cy="63" r="4.5" fill="#F2A08F" />
      <circle cx="71" cy="63" r="4.5" fill="#F2A08F" />
      <path className="av-mouth" d="M44 70 Q50 74 56 70" stroke="#7A3510" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  orangutan: (
    <>
      <circle cx="50" cy="50" r="50" fill="#F7C9A0" />
      <ellipse cx="20" cy="58" rx="9" ry="13" fill="#C9682F" />
      <ellipse cx="80" cy="58" rx="9" ry="13" fill="#C9682F" />
      <circle cx="50" cy="52" r="31" fill="#B5541E" />
      <path d="M38 26 Q44 12 50 22 Q56 10 62 26" fill="#B5541E" />
      <ellipse cx="50" cy="60" rx="21" ry="20" fill="#E7A97A" />
      <g className="av-eyes">
        <circle cx="42" cy="52" r="4.5" fill="#2E2118" />
        <circle cx="58" cy="52" r="4.5" fill="#2E2118" />
        <circle cx="43.4" cy="50.4" r="1.5" fill="#fff" />
        <circle cx="59.4" cy="50.4" r="1.5" fill="#fff" />
      </g>
      <circle cx="47" cy="61" r="1.6" fill="#7A3510" />
      <circle cx="53" cy="61" r="1.6" fill="#7A3510" />
      <path className="av-mouth" d="M41 68 Q50 76 59 68" stroke="#7A3510" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  komodo: (
    <>
      <circle cx="50" cy="50" r="50" fill="#CDE7B0" />
      <circle cx="35" cy="40" r="11" fill="#6E8B3D" />
      <circle cx="65" cy="40" r="11" fill="#6E8B3D" />
      <ellipse cx="50" cy="60" rx="32" ry="23" fill="#6E8B3D" />
      <circle cx="35" cy="39" r="7" fill="#fff" />
      <circle cx="65" cy="39" r="7" fill="#fff" />
      <g className="av-eyes">
        <circle cx="36" cy="40" r="3.8" fill="#2E2118" />
        <circle cx="64" cy="40" r="3.8" fill="#2E2118" />
      </g>
      <circle cx="28" cy="62" r="3" fill="#8FAE55" />
      <circle cx="72" cy="60" r="3.5" fill="#8FAE55" />
      <circle cx="45" cy="58" r="1.8" fill="#3F5420" />
      <circle cx="55" cy="58" r="1.8" fill="#3F5420" />
      <path className="av-mouth" d="M32 68 Q50 80 68 68" stroke="#3F5420" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M50 75 L50 86 M50 86 L46 91 M50 86 L54 91" stroke="#D9536B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  jalak: (
    <>
      <circle cx="50" cy="50" r="50" fill="#BFD9F2" />
      <path d="M42 30 Q42 10 50 20 Q56 8 60 30 Z" fill="#fff" stroke="#D5DCE5" strokeWidth="1.5" />
      <circle cx="50" cy="56" r="30" fill="#fff" stroke="#D5DCE5" strokeWidth="1.5" />
      <ellipse cx="38" cy="52" rx="9" ry="7.5" fill="#3C7DD9" />
      <ellipse cx="62" cy="52" rx="9" ry="7.5" fill="#3C7DD9" />
      <g className="av-eyes">
        <circle cx="38" cy="52" r="3.8" fill="#2E2118" />
        <circle cx="62" cy="52" r="3.8" fill="#2E2118" />
        <circle cx="39.2" cy="50.6" r="1.3" fill="#fff" />
        <circle cx="63.2" cy="50.6" r="1.3" fill="#fff" />
      </g>
      <polygon className="av-mouth" points="43,61 57,61 50,74" fill="#F2B632" />
      <circle cx="30" cy="66" r="4" fill="#F7B7C4" />
      <circle cx="70" cy="66" r="4" fill="#F7B7C4" />
    </>
  ),
  gajah: (
    <>
      <circle cx="50" cy="50" r="50" fill="#DCD7EB" />
      <ellipse cx="21" cy="50" rx="17" ry="21" fill="#9A93B0" />
      <ellipse cx="79" cy="50" rx="17" ry="21" fill="#9A93B0" />
      <ellipse cx="23" cy="51" rx="10" ry="14" fill="#C9B8D6" />
      <ellipse cx="77" cy="51" rx="10" ry="14" fill="#C9B8D6" />
      <circle cx="50" cy="48" r="26" fill="#ABA4C2" />
      <path className="av-mouth" d="M43 60 Q42 82 53 87 Q61 88 59 81 Q53 77 57 60 Z" fill="#ABA4C2" />
      <g className="av-eyes">
        <circle cx="41" cy="45" r="4.5" fill="#2E2118" />
        <circle cx="59" cy="45" r="4.5" fill="#2E2118" />
        <circle cx="42.4" cy="43.4" r="1.5" fill="#fff" />
        <circle cx="60.4" cy="43.4" r="1.5" fill="#fff" />
      </g>
      <circle cx="33" cy="56" r="4" fill="#F2B3C4" />
      <circle cx="67" cy="56" r="4" fill="#F2B3C4" />
    </>
  ),
  harimau: (
    <>
      <circle cx="50" cy="50" r="50" fill="#FFE0A3" />
      <circle cx="27" cy="30" r="10" fill="#EE8E2E" />
      <circle cx="73" cy="30" r="10" fill="#EE8E2E" />
      <circle cx="27" cy="30" r="4.5" fill="#FFF3E2" />
      <circle cx="73" cy="30" r="4.5" fill="#FFF3E2" />
      <circle cx="50" cy="55" r="30" fill="#EE8E2E" />
      <path
        d="M50 26 L50 36 M41 28 L43 36 M59 28 L57 36 M21 50 L30 53 M21 59 L30 59 M79 50 L70 53 M79 59 L70 59"
        stroke="#2E2118"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="50" cy="67" rx="15" ry="11" fill="#FFF3E2" />
      <g className="av-eyes">
        <circle cx="40" cy="51" r="4.5" fill="#2E2118" />
        <circle cx="60" cy="51" r="4.5" fill="#2E2118" />
        <circle cx="41.4" cy="49.4" r="1.5" fill="#fff" />
        <circle cx="61.4" cy="49.4" r="1.5" fill="#fff" />
      </g>
      <path d="M45 61 L55 61 L50 66 Z" fill="#2E2118" />
      <path className="av-mouth" d="M44 70 Q50 74 56 70" stroke="#7A3510" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  kancil: (
    <>
      <circle cx="50" cy="50" r="50" fill="#F3E1C4" />
      <ellipse cx="30" cy="28" rx="7" ry="15" fill="#B98654" transform="rotate(-28 30 28)" />
      <ellipse cx="70" cy="28" rx="7" ry="15" fill="#B98654" transform="rotate(28 70 28)" />
      <ellipse cx="30" cy="29" rx="3.5" ry="9" fill="#F2C9A8" transform="rotate(-28 30 29)" />
      <ellipse cx="70" cy="29" rx="3.5" ry="9" fill="#F2C9A8" transform="rotate(28 70 29)" />
      <ellipse cx="50" cy="56" rx="25" ry="29" fill="#B98654" />
      <ellipse cx="50" cy="73" rx="13" ry="10" fill="#E8CDA8" />
      <ellipse className="av-mouth" cx="50" cy="69" rx="4.5" ry="3" fill="#2E2118" />
      <g className="av-eyes">
        <circle cx="40" cy="51" r="6" fill="#2E2118" />
        <circle cx="60" cy="51" r="6" fill="#2E2118" />
        <circle cx="42" cy="49" r="2" fill="#fff" />
        <circle cx="62" cy="49" r="2" fill="#fff" />
      </g>
      <circle cx="35" cy="38" r="1.8" fill="#F3E1C4" />
      <circle cx="64" cy="36" r="1.8" fill="#F3E1C4" />
    </>
  ),
  kura: (
    <>
      <circle cx="50" cy="50" r="50" fill="#BEE5DC" />
      <path d="M18 52 Q50 4 82 52 Z" fill="#3E8C6E" />
      <path d="M36 40 L50 26 L64 40 M50 26 L50 48" stroke="#2C6A52" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <circle cx="50" cy="64" r="22" fill="#8CCB8A" />
      <g className="av-eyes">
        <circle cx="42" cy="61" r="4.5" fill="#2E2118" />
        <circle cx="58" cy="61" r="4.5" fill="#2E2118" />
        <circle cx="43.4" cy="59.4" r="1.5" fill="#fff" />
        <circle cx="59.4" cy="59.4" r="1.5" fill="#fff" />
      </g>
      <circle cx="35" cy="70" r="3.5" fill="#F2B3A0" />
      <circle cx="65" cy="70" r="3.5" fill="#F2B3A0" />
      <path className="av-mouth" d="M44 72 Q50 77 56 72" stroke="#2C6A52" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
};

export type AvatarMood = 'idle' | 'happy' | 'sad' | 'think';

export function Avatar({
  kind,
  size = 56,
  mood = 'idle',
  title,
  decorative,
}: {
  kind: AvatarKind;
  size?: number;
  mood?: AvatarMood;
  title?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      className={`avatar mood-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : (title ?? `Avatar ${AVATAR_NAMES[kind]}`)}
    >
      {faces[kind]}
    </svg>
  );
}
