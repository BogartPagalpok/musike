import type { CSSProperties, ComponentType, ReactNode } from "react";

/**
 * UI icon set backed by Streamline Core (Core Line / Core Solid, 14x14 grid, CC BY 4.0).
 * Hand-crafted directional chevrons and status indicators share the exact 14x14 optical grid.
 */
export type IconWeight = "regular" | "bold" | "fill" | "duotone";

export interface IconProps {
  size?: number | string;
  weight?: IconWeight;
  mirrored?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
}

export type Icon = ComponentType<IconProps>;

function SvgIcon({
  size = 16,
  mirrored,
  className,
  style,
  "aria-hidden": ariaHidden = true,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 14"
      width={size}
      height={size}
      fill="none"
      aria-hidden={ariaHidden}
      className={className}
      style={{
        flexShrink: 0,
        transform: mirrored ? "scaleX(-1)" : undefined,
        ...style,
      }}
    >
      {children}
    </svg>
  );
}

function strokeW(weight?: IconWeight): number {
  return weight === "bold" ? 1.4 : 1.15;
}

export function PlayIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M2.67593 0.019165c-0.29576 0 -0.58657 0.0753875 -0.84499 0.218948 -0.26314 0.134139 -0.48525 0.336896 -0.64277 0.58693 -0.15979 0.253627 -0.247004 0.546207 -0.252169 0.845927l-0.000075 0V12.3396H0.935852l0.000149 0.0086c0.005165 0.2997 0.092379 0.5923 0.252169 0.8459 0.15752 0.2501 0.37963 0.4528 0.64277 0.587 0.25842 0.1435 0.54923 0.2189 0.84499 0.2189 0.29995 0 0.59481 -0.0775 0.85596 -0.2251 0.00575 -0.0032 0.01143 -0.0066 0.01704 -0.0101l8.62977 -5.33745c0.2617 -0.13189 0.4826 -0.33282 0.6388 -0.5813 0.1611 -0.25659 0.2467 -0.55345 0.2467 -0.85647 0 -0.30301 -0.0856 -0.59988 -0.2467 -0.85646 -0.1563 -0.24874 -0.3776 -0.44984 -0.6396 -0.58172L3.54751 0.253465c-0.00515 -0.00316 -0.01036 -0.006227 -0.01562 -0.009199 -0.26115 -0.1475588 -0.55601 -0.225101 -0.85596 -0.225101Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M1.43591 12.3299c0.00359 0.2084 0.06422 0.4118 0.17529 0.5881 0.11107 0.1763 0.26834 0.3188 0.45471 0.4119 0.18611 0.1052 0.39624 0.1605 0.61 0.1605s0.4239 -0.0553 0.61 -0.1605l8.64999 -5.34996c0.1882 -0.09067 0.347 -0.23262 0.4582 -0.40952 0.1111 -0.1769 0.17 -0.38157 0.17 -0.59048 0 -0.20891 -0.0589 -0.41358 -0.17 -0.59048 -0.1112 -0.1769 -0.27 -0.31885 -0.4582 -0.40952L3.28591 0.669938c-0.1861 -0.105157 -0.39624 -0.160417 -0.61 -0.160417s-0.42389 0.05526 -0.61 0.160417c-0.18637 0.093189 -0.34364 0.235677 -0.45471 0.411982 -0.11107 0.1763 -0.1717 0.37968 -0.17529 0.58802V12.3299Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function PauseIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M0 1.5C0 0.671573 0.671573 0 1.5 0H4c0.82843 0 1.5 0.671573 1.5 1.5v11c0 0.8284 -0.67157 1.5 -1.5 1.5H1.5C0.671573 14 0 13.3284 0 12.5v-11ZM10 0c-0.82843 0 -1.5 0.671573 -1.5 1.5v11c0 0.8284 0.67157 1.5 1.5 1.5h2.5c0.8284 0 1.5 -0.6716 1.5 -1.5v-11c0 -0.828427 -0.6716 -1.5 -1.5 -1.5H10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M4 0.5H1.5c-0.552285 0 -1 0.447715 -1 1v11c0 0.5523 0.447715 1 1 1H4c0.55228 0 1 -0.4477 1 -1v-11c0 -0.552285 -0.44772 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 0.5H10c-0.55228 0 -1 0.447715 -1 1v11c0 0.5523 0.44772 1 1 1h2.5c0.5523 0 1 -0.4477 1 -1v-11c0 -0.552285 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function SkipBackIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M4.23788 6.056 12.0569 0.656892c0.3956 -0.250546 0.8779 -0.183759 1.2264 0.078205 0.2686 0.201892 0.4578 0.519713 0.4667 0.897543V12.3333l0 0.0043c0 0.884 -0.9789 1.4562 -1.6931 1.0039L4.23788 7.97496c-0.65051 -0.43882 -0.65051 -1.48014 0 -1.91896ZM0.0000610352 1.74216c0 -0.55229 0.4477149648 -1.000003 0.9999989648 -1.000003 0.55229 0 1 0.447713 1 1.000003V12.2578c0 0.5523 -0.44771 1 -1 1 -0.552284 0 -0.9999999185 -0.4477 -0.9999989648 -1V1.74216Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M0.5 0.5v13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.48 11.6599c0.0005 0.1799 -0.0475 0.3566 -0.139 0.5115 -0.0916 0.1549 -0.2232 0.2822 -0.381 0.3685 -0.152 0.0878 -0.3244 0.134 -0.5 0.134 -0.1755 0 -0.3479 -0.0462 -0.5 -0.134L4.77004 7.83994c-0.14035 -0.09065 -0.25575 -0.21503 -0.33565 -0.36177 -0.0799 -0.14673 -0.12177 -0.31115 -0.12177 -0.47823s0.04187 -0.3315 0.12177 -0.47823c0.0799 -0.14674 0.1953 -0.27111 0.33565 -0.36177l7.20996 -4.66c0.1521 -0.08777 0.3245 -0.13397 0.5 -0.13397 0.1756 0 0.348 0.0462 0.5 0.13397 0.1579 0.08635 0.2894 0.21367 0.381 0.36854 0.0915 0.15488 0.1395 0.33157 0.139 0.51146l-0.02 9.27996Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function SkipForwardIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M9.51212 6.056 1.6931 0.656892C1.29745 0.406346 0.815218 0.473133 0.466699 0.735097 0.198102 0.936989 0.00892463 1.25481 0.0000077775 1.63264V12.3333C0.000002589 12.3347 0 12.3362 0 12.3376c9.627e-7 0.884 0.978943 1.4562 1.6931 1.0039l7.81902 -5.36654c0.65048 -0.43882 0.65048 -1.48014 0 -1.91896Zm4.23778 -4.31384c0 -0.55229 -0.4477 -1.000003 -1 -1.000003 -0.5522 0 -1 0.447713 -1 1.000003V12.2578c0 0.5523 0.4478 1 1 1 0.5523 0 1 -0.4477 1 -1V1.74216Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M13.5 0.5v13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.520004 11.6599c-0.000491 0.1799 0.047553 0.3566 0.139069 0.5115 0.091517 0.1549 0.223116 0.2822 0.380927 0.3685 0.15202 0.0878 0.32447 0.134 0.5 0.134 0.17554 0 0.34798 -0.0462 0.5 -0.134l7.19 -4.69996c0.14035 -0.09065 0.25575 -0.21503 0.33565 -0.36177 0.0799 -0.14673 0.12177 -0.31115 0.12177 -0.47823s-0.04187 -0.3315 -0.12177 -0.47823c-0.0799 -0.14674 -0.1953 -0.27111 -0.33565 -0.36177l-7.21 -4.66c-0.15202 -0.08777 -0.32446 -0.13397 -0.5 -0.13397 -0.17553 0 -0.34798 0.0462 -0.5 0.13397 -0.15781 0.08635 -0.28941 0.21367 -0.380927 0.36854 -0.091516 0.15488 -0.13956 0.33157 -0.139069 0.51146l0.02 9.27996Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function HeartIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M4.0238 1.08512c0.98053 0.07105 2.00224 0.54903 2.98028 1.5164 0.97779 -0.9671 1.9986 -1.44417 2.97822 -1.51364 1.1056 -0.07841 2.083 0.36844 2.7902 1.07345 1.3903 1.38614 1.8269 3.89436 0.1017 5.6196 -0.0058 0.00582 -0.0118 0.0115 -0.0179 0.01702L7.33974 12.7949c-0.19051 0.1725 -0.48082 0.1725 -0.67133 0L1.15183 7.79795c-0.0061 -0.00552 -0.01206 -0.0112 -0.01788 -0.01702 -1.73423 -1.73423 -1.299958 -4.24274 0.09494 -5.6278 0.70889 -0.7039 1.68828 -1.14819 2.79491 -1.06801Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M7.0041 12.3826 1.52973 7.42397c-2.97521 -2.97521 1.39834 -8.6876 5.47437 -4.06612 4.076 -4.62148 8.4298 1.11075 5.4744 4.06612L7.0041 12.3826Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function HouseIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M0.318182 6.0449C0.115244 6.23405 0 6.499 0 6.77642V12.5c0 0.8284 0.671573 1.5 1.5 1.5H6v-3c0 -0.5523 0.44772 -1 1 -1s1 0.4477 1 1v3h4.5c0.8284 0 1.5 -0.6716 1.5 -1.5V6.77642c0 -0.27742 -0.1152 -0.54237 -0.3182 -0.73152L7.3254 0.120372c-0.18725 -0.1604958 -0.46355 -0.160496 -0.6508 0L0.318182 6.0449Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M13.5 6.94c0.001 -0.1388 -0.027 -0.27628 -0.0821 -0.40368 -0.0551 -0.1274 -0.1361 -0.24194 -0.2379 -0.33632L7.00002 0.5 0.820023 6.2c-0.101775 0.09438 -0.182787 0.20892 -0.23788 0.33632S0.499084 6.8012 0.500023 6.94v5.56c0 0.2652 0.105357 0.5196 0.292893 0.7071s0.441894 0.2929 0.707104 0.2929H12.5c0.2652 0 0.5196 -0.1054 0.7071 -0.2929 0.1876 -0.1875 0.2929 -0.4419 0.2929 -0.7071V6.94Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 13.5v-4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function HardDriveIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M0.588074 6.07066c0.157626 -0.0337 0.321169 -0.05143 0.488856 -0.05143H12.9231c0.179 0 0.3533 0.02021 0.5207 0.05848L12.186 1.16237c-0.0773 -0.335216 -0.2676 -0.633741 -0.539 -0.845427 -0.2717 -0.211943 -0.6081 -0.32382175 -0.9525 -0.3169481383H3.30003v-0.0000075698l-0.00275 0.0000151395C2.95822 0.00186841 2.62979 0.118554 2.36556 0.331032c-0.26219 0.210826 -0.44582 0.503619 -0.52152 0.831268L0.588074 6.07066ZM12.9231 7.26923H1.07692C0.482155 7.26923 0 7.75138 0 8.34615v4.30765c0 0.5948 0.482155 1.077 1.07692 1.077H12.9231c0.5947 0 1.0769 -0.4822 1.0769 -1.077V8.34615c0 -0.59477 -0.4822 -1.07692 -1.0769 -1.07692ZM3.5 9.87499c-0.34518 0 -0.625 0.27981 -0.625 0.62501 0 0.3452 0.27982 0.625 0.625 0.625h3c0.34518 0 0.625 -0.2798 0.625 -0.625s-0.27982 -0.62501 -0.625 -0.62501h-3ZM9.50311 10.5c0 -0.55058 0.44633 -0.99691 0.99689 -0.99691 0.5506 0 0.9969 0.44633 0.9969 0.99691 0 0.5506 -0.4463 0.9969 -0.9969 0.9969 -0.55056 0 -0.99689 -0.4463 -0.99689 -0.9969Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M12.5 7.5h-11c-0.552285 0 -1 0.44772 -1 1v4c0 0.5523 0.447715 1 1 1h11c0.5523 0 1 -0.4477 1 -1v-4c0 -0.55228 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m0.590027 8.08005 1.740003 -6.8c0.04972 -0.2205 0.17269 -0.417658 0.34885 -0.559309 0.17615 -0.141652 0.39511 -0.219442 0.62115 -0.220686H10.7c0.2312 -0.00565 0.4572 0.068984 0.6395 0.211199 0.1823 0.142214 0.3097 0.343216 0.3605 0.568796l1.74 6.8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 10.5h3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 11c0.2761 0 0.5 -0.2239 0.5 -0.5s-0.2239 -0.5 -0.5 -0.5 -0.5 0.2239 -0.5 0.5 0.2239 0.5 0.5 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function BooksIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M6.375 1.653C5.386 1.099 3.536 0.42 1.496 0.179 0.674 0.082 0 0.76 0 1.588v8c0 0.829 0.677 1.489 1.492 1.637 1.84 0.334 3.371 1.216 4.348 1.914 0.164 0.117 0.345 0.205 0.535 0.266V1.653Zm1.25 11.752c0.19 -0.06 0.37 -0.149 0.534 -0.265 0.977 -0.698 2.508 -1.581 4.349 -1.915 0.815 -0.148 1.492 -0.808 1.492 -1.637v-8C14 0.76 13.326 0.082 12.504 0.18c-2.04 0.242 -3.89 0.92 -4.879 1.474v11.752Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M7.00002 13.4999c-1.46476 -1.6127 -3.45121 -2.6572 -5.61 -2.95 -0.24572 -0.0272 -0.472659 -0.1445 -0.637017 -0.3291 -0.164358 -0.1847 -0.254484 -0.42371 -0.252985 -0.67092v-8.05c-0.000009 -0.14444 0.031272 -0.28717 0.091692 -0.41837C0.652129 0.950317 0.740253 0.833766 0.850018 0.739879 0.95785 0.6477 1.08406 0.579519 1.22027 0.539864c0.1362 -0.039655 0.27929 -0.049876 0.41975 -0.029985 2.06429 0.342607 3.95272 1.371381 5.36 2.920001V13.4999Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 13.4999c1.46476 -1.6127 3.4512 -2.6572 5.61 -2.95 0.2457 -0.0272 0.4727 -0.1445 0.637 -0.3291 0.1644 -0.1847 0.2545 -0.42371 0.253 -0.67092v-8.05c0 -0.14444 -0.0313 -0.28717 -0.0917 -0.41837 -0.0604 -0.131193 -0.1485 -0.247744 -0.2583 -0.341631 -0.1078 -0.092179 -0.234 -0.16036 -0.3702 -0.200015 -0.1363 -0.039655 -0.2793 -0.049876 -0.4198 -0.029985C10.2957 0.852486 8.40728 1.88126 7 3.42988V13.4999Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function CheckIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M13.637 1.198a1 1 0 0 1 0.134 1.408l-8.04 9.73 -0.003 0.002a1.922 1.922 0 0 1 -1.5 0.693 1.923 1.923 0 0 1 -1.499 -0.748l-0.001 -0.002L0.21 9.045a1 1 0 1 1 1.578 -1.228l2.464 3.167 7.976 -9.652a1 1 0 0 1 1.408 -0.134Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M0.5 8.55005 3.23 12.06c0.09212 0.1197 0.21016 0.217 0.34525 0.2846 0.13509 0.0675 0.28373 0.1036 0.43475 0.1054 0.14859 0.0018 0.2957 -0.0297 0.43063 -0.0919 0.13492 -0.0623 0.25427 -0.1539 0.34937 -0.2681L13.5 1.55005" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function FolderOpenIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      {weight === "fill" ? (
        <>
          <path d="M5.18345 0.75018c0.33987 -0.008085 0.6725 0.099529 0.9433 0.30533 0.2727 0.20726 0.46626 0.5016 0.54849 0.83409l0.0002 0.00079 0.21495 0.85979H12.5c0.3978 0 0.7794 0.15804 1.0607 0.43934S14 3.85236 14 4.25018v2.9753c-0.081 -0.08582 -0.1656 -0.16865 -0.2535 -0.24826 -0.8897 -0.80564 -2.0575 -1.22866 -3.2386 -1.22866 -0.53046 0 -1.03917 0.21071 -1.41424 0.58578 -0.37507 0.37508 -0.58579 0.88379 -0.58579 1.41422v1.85265c-1.08304 0.42849 -1.84912 1.48499 -1.84912 2.72049 0 0.3245 0.05287 0.6368 0.15047 0.9285H1.5c-0.39783 0 -0.779356 -0.1581 -1.06066 -0.4394C0.158035 12.5295 0 12.148 0 11.7502V2.25018c0 -0.39782 0.158035 -0.77936 0.43934 -1.06066C0.720644 0.908216 1.10218 0.75018 1.5 0.75018h3.68345Zm4.79409 6.46805c0.14066 -0.14065 0.33146 -0.21967 0.53036 -0.21967 0.8874 0 1.7516 0.31852 2.3996 0.90525 0.6504 0.58896 1.032 1.40465 1.032 2.27299 0 0.4142 -0.3357 0.75 -0.75 0.75 -0.4142 0 -0.75 -0.3358 -0.75 -0.75 0 -0.41974 -0.1834 -0.83929 -0.5388 -1.16109 -0.1822 -0.16494 -0.4011 -0.29596 -0.6428 -0.38486v3.68165l0 0.0092c0 0.9248 -0.7497 1.6745 -1.67454 1.6745 -0.92483 0 -1.67455 -0.7497 -1.67455 -1.6745 0 -0.9248 0.74972 -1.6746 1.67455 -1.6746 0.05893 0 0.11715 0.0031 0.17451 0.009V7.74856c0 -0.19891 0.07902 -0.38968 0.21967 -0.53033Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
        </>
      ) : (
        <>
          <path d="M5.5 11.9999h-4c-0.26522 0 -0.51957 -0.1053 -0.707107 -0.2929C0.605357 11.5195 0.5 11.2652 0.5 10.9999V1.49994c0 -0.26522 0.105357 -0.519574 0.292893 -0.707111C0.98043 0.605293 1.23478 0.499936 1.5 0.499936h3.69c0.22843 -0.006655 0.45226 0.065133 0.63421 0.203414 0.18194 0.13828 0.31104 0.33471 0.36579 0.55659l0.28 1.24h6c0.2652 0 0.5196 0.10535 0.7071 0.29289 0.1875 0.18754 0.2929 0.44189 0.2929 0.70711v2" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.25 13.5c0.69036 0 1.25 -0.5596 1.25 -1.25S9.94036 11 9.25 11 8 11.5596 8 12.25s0.55964 1.25 1.25 1.25Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 12.25V7.50002c0.3807 -0.02299 0.7621 0.03122 1.1213 0.15935 0.3592 0.12813 0.6888 0.32755 0.9691 0.58628 0.2802 0.25872 0.5052 0.57141 0.6615 0.91929 0.1563 0.34788 0.2407 0.72376 0.2481 1.10506" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </SvgIcon>
  );
}

export function ArrowCounterClockwiseIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M4.75 0.5 2.25 3l2.5 2.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.75 8.25c0 1.03835 0.30791 2.0534 0.88478 2.9167 0.57688 0.8634 1.39682 1.5363 2.35613 1.9337 0.95931 0.3973 2.01491 0.5013 3.03331 0.2987 1.0184 -0.2025 1.95387 -0.7026 2.68808 -1.4368 0.7342 -0.7342 1.2343 -1.6697 1.4368 -2.68808 0.2026 -1.0184 0.0986 -2.074 -0.2987 -3.03331 -0.3974 -0.95931 -1.0703 -1.77925 -1.93366 -2.35613C9.05339 3.30791 8.03835 3 7 3H2.25" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowLeftIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M6.5 7h-6" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 4.5 0.5 7 3 9.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 0.5H10c-0.55228 0 -1 0.447715 -1 1v11c0 0.5523 0.44772 1 1 1h2.5c0.5523 0 1 -0.4477 1 -1v-11c0 -0.552285 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowRightIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M7.5 7h6" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 4.5 13.5 7 11 9.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 13.5H4c0.55228 0 1 -0.4477 1 -1l0 -11c0 -0.552285 -0.44772 -1 -1 -1H1.5c-0.552285 0 -1 0.447715 -1 1l0 11c0 0.5523 0.447715 1 1 1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowsClockwiseIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M9 0.5 11.5 3 9 5.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 6V4c0 -0.26522 0.105357 -0.51957 0.292893 -0.70711C0.98043 3.10536 1.23478 3 1.5 3h10" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13.5 2.5 11 5 8.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 8v2c0 0.2652 -0.1054 0.5196 -0.2929 0.7071S12.7652 11 12.5 11h-10" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowsInIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m0.5 13.5 4 -4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 9.5h3.5V13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.5 13.5 -4 -4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 9.5H9.5V13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m0.5 0.5 4 4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 4.5h3.5V1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.5 0.5 -4 4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 4.5H9.5V1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowsMergeIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M0.675049 4.12927 0.785059 0.61001 4.30432 0.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.783447 0.60791 6.99943 6.6966" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m7 6.69971 0 6.80019" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.325 4.12927 13.2149 0.61001 9.69568 0.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2166 0.60791 7.00061 6.6966" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowsOutIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m8.5 5.5 5 -5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 0.5h4v4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5.5 5.5 -5 -5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 0.5h-4v4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.5 8.5 5 5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 13.5h4v-4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5.5 8.5 -5 5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 13.5h-4v-4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function BroadcastIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M12.5 4h-11c-0.552285 0 -1 0.44772 -1 1v7.5c0 0.5523 0.447715 1 1 1h11c0.5523 0 1 -0.4477 1 -1V5c0 -0.55228 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.37 4 13.5 0.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 11.5c0.82843 0 1.5 -0.6716 1.5 -1.5 0 -0.82843 -0.67157 -1.5 -1.5 -1.5S3 9.17157 3 10c0 0.8284 0.67157 1.5 1.5 1.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 8.75H11" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 11.25H11" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 6.5h13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ClockCounterClockwiseIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M7 13.5c3.5899 0 6.5 -2.9101 6.5 -6.5C13.5 3.41015 10.5899 0.5 7 0.5 3.41015 0.5 0.5 3.41015 0.5 7c0 3.5899 2.91015 6.5 6.5 6.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4.5V7l2.54 2.96" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ClockIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M7 13.5c3.5899 0 6.5 -2.9101 6.5 -6.5C13.5 3.41015 10.5899 0.5 7 0.5 3.41015 0.5 0.5 3.41015 0.5 7c0 3.5899 2.91015 6.5 6.5 6.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4.5V7l2.54 2.96" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CopyIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M8.5 3.5v-1c0 -0.26522 -0.10536 -0.51957 -0.29289 -0.70711C8.01957 1.60536 7.76522 1.5 7.5 1.5h-1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10.5H1.5c-0.26522 0 -0.51957 -0.1054 -0.707107 -0.2929C0.605357 10.0196 0.5 9.76522 0.5 9.5v-7c0 -0.26522 0.105357 -0.51957 0.292893 -0.70711C0.98043 1.60536 1.23478 1.5 1.5 1.5h1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 5.5h-5c-0.55228 0 -1 0.44772 -1 1v6c0 0.5523 0.44772 1 1 1h5c0.5523 0 1 -0.4477 1 -1v-6c0 -0.55228 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.75 0.5h-4.5l0.41 1.62c0.02498 0.10843 0.08611 0.20513 0.17335 0.27419 0.08724 0.06906 0.19538 0.10638 0.30665 0.10581h2.72c0.11127 0.00057 0.21941 -0.03675 0.30665 -0.10581 0.08724 -0.06906 0.14837 -0.16576 0.17335 -0.27419L6.75 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 8.5h3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 10.5h3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CornersInIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m0.5 13.5 5 -5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 8.5h4v4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.5 0.5 -5 5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 5.5h-4v-4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function DatabaseIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M7 5.5c3.5899 0 6.5 -1.11929 6.5 -2.5S10.5899 0.5 7 0.5C3.41015 0.5 0.5 1.61929 0.5 3S3.41015 5.5 7 5.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 3v8c0 1.38 2.91 2.5 6.5 2.5s6.5 -1.12 6.5 -2.5V3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 7c0 1.38 -2.91 2.5 -6.5 2.5S0.5 8.38 0.5 7" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function DownloadSimpleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M12.5 12.5c0 0.2652 -0.1054 0.5196 -0.2929 0.7071s-0.4419 0.2929 -0.7071 0.2929h-9c-0.26522 0 -0.51957 -0.1054 -0.70711 -0.2929C1.60536 13.0196 1.5 12.7652 1.5 12.5v-11c0 -0.26522 0.10536 -0.51957 0.29289 -0.707107C1.98043 0.605357 2.23478 0.5 2.5 0.5H9L12.5 4v8.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 8 -2 2 -2 -2" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m7 10 0 -5.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function EqualizerIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1 5.5v3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 3v8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 0.5v13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 3v8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 5.5v3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function EyedropperIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M12.4163 1.58358c-0.3247 -0.32755 -0.711 -0.587552 -1.1367 -0.764987 -0.4257 -0.177434 -0.8824 -0.268788 -1.34356 -0.268788 -0.4612 0 -0.91783 0.091354 -1.34353 0.268788 -0.4257 0.177435 -0.81204 0.437437 -1.13671 0.764987L2.9021 6.13729c-0.45118 0.45045 -0.74578 1.03386 -0.84044 1.66433 -0.09466 0.63048 0.01563 1.27468 0.31463 1.83776L0.838542 11.1771c-0.184778 0.1859 -0.288493 0.4374 -0.288493 0.6995 0 0.262 0.103715 0.5135 0.288493 0.6994l0.585338 0.5853c0.18588 0.1848 0.43733 0.2885 0.69942 0.2885 0.2621 0 0.51355 -0.1037 0.69943 -0.2885l1.53774 -1.5377c0.56308 0.299 1.20729 0.4093 1.83776 0.3146 0.63047 -0.0947 1.21389 -0.3893 1.66433 -0.8404l4.55374 -4.55375c0.3275 -0.32467 0.5875 -0.71101 0.765 -1.13671 0.1774 -0.4257 0.2687 -0.88233 0.2687 -1.34352 0 -0.4612 -0.0913 -0.91783 -0.2687 -1.34353 -0.1775 -0.4257 -0.4375 -0.81204 -0.765 -1.13671v0Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.51917 1.54395 7.93673 7.93674" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function FunnelSimpleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M13.5 0.5H0.5l5 7v6l3 -2v-4l5 -7Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function GearSixIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m5.23004 2.25 0.43 -1.11c0.07252 -0.187936 0.20011 -0.349589 0.36605 -0.463788C6.19204 0.562014 6.3886 0.500595 6.59004 0.5h0.82c0.20144 0.000595 0.39801 0.062014 0.56395 0.176212 0.16595 0.114199 0.29353 0.275852 0.36605 0.463788l0.43 1.11 1.45996 0.84 1.18 -0.18c0.1965 -0.02667 0.3965 0.00567 0.5746 0.09292 0.178 0.08725 0.3261 0.22546 0.4254 0.39708l0.4 0.7c0.1025 0.17435 0.1498 0.37568 0.1355 0.57742 -0.0143 0.20174 -0.0894 0.39441 -0.2155 0.55258l-0.73 0.93v1.68l0.75 0.93c0.1261 0.15817 0.2012 0.35084 0.2155 0.55258 0.0143 0.20174 -0.033 0.40307 -0.1355 0.57742l-0.4 0.7c-0.0993 0.1716 -0.2474 0.3098 -0.4254 0.3971 -0.1781 0.0872 -0.3781 0.1196 -0.5746 0.0929l-1.18 -0.18 -1.45996 0.84 -0.43 1.11c-0.07252 0.1879 -0.2001 0.3496 -0.36605 0.4638 -0.16594 0.1142 -0.36251 0.1756 -0.56395 0.1762h-0.84c-0.20144 -0.0006 -0.398 -0.062 -0.56395 -0.1762 -0.16594 -0.1142 -0.29353 -0.2759 -0.36605 -0.4638l-0.43 -1.11 -1.46 -0.84 -1.18 0.18c-0.19648 0.0267 -0.39646 -0.0057 -0.57452 -0.0929 -0.17805 -0.0873 -0.32615 -0.2255 -0.42548 -0.3971l-0.4 -0.7c-0.1025 -0.17435 -0.14972 -0.37568 -0.13544 -0.57742 0.01428 -0.20174 0.0894 -0.39441 0.21544 -0.55258l0.73 -0.93V6.16l-0.75 -0.93c-0.12604 -0.15817 -0.20116 -0.35084 -0.21544 -0.55258 -0.01428 -0.20174 0.03294 -0.40307 0.13544 -0.57742l0.4 -0.7c0.09933 -0.17162 0.24743 -0.30983 0.42548 -0.39708 0.17806 -0.08725 0.37804 -0.11959 0.57452 -0.09292l1.18 0.18 1.48 -0.84Zm-0.23 4.75c0 0.39556 0.1173 0.78224 0.33706 1.11114 0.21977 0.3289 0.53212 0.58524 0.89757 0.73662 0.36546 0.15137 0.76759 0.19098 1.15555 0.11381 0.38796 -0.07717 0.74433 -0.26765 1.02404 -0.54736 0.2797 -0.2797 0.47018 -0.63607 0.54735 -1.02403 0.07717 -0.38796 0.03757 -0.79009 -0.11381 -1.15555 -0.15137 -0.36545 -0.40772 -0.67781 -0.73662 -0.89757C7.78228 5.1173 7.3956 5 7.00004 5c-0.53043 0 -1.03914 0.21071 -1.41421 0.58579 -0.37507 0.37507 -0.58579 0.88378 -0.58579 1.41421v0Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function HeadphonesIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M11.5 0.500003c0.7374 -0.001082 1.4494 0.269471 2 0.759997v4.48c-0.5506 0.49053 -1.2626 0.76109 -2 0.76 -0.1663 0.01524 -0.3337 0.01524 -0.5 0v5.75c0 0.3315 -0.1317 0.6495 -0.3661 0.8839 -0.2344 0.2344 -0.5524 0.3661 -0.8839 0.3661 -0.33152 0 -0.64946 -0.1317 -0.88388 -0.3661C8.6317 12.8995 8.5 12.5815 8.5 12.25V3.5c0 -0.79565 0.31607 -1.55871 0.87868 -2.12132C9.94129 0.816074 10.7044 0.500003 11.5 0.500003Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 0.500003C1.76258 0.498921 1.0506 0.769474 0.5 1.26v4.48c0.5506 0.49053 1.26258 0.76109 2 0.76 0.16632 0.01524 0.33368 0.01524 0.5 0v5.75c0 0.3315 0.1317 0.6495 0.36612 0.8839 0.23442 0.2344 0.55236 0.3661 0.88388 0.3661 0.33152 0 0.64946 -0.1317 0.88388 -0.3661 0.23442 -0.2344 0.36612 -0.5524 0.36612 -0.8839V3.5c0 -0.79565 -0.31607 -1.55871 -0.87868 -2.12132C4.05871 0.816074 3.29565 0.500003 2.5 0.500003Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function KeyboardIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M3.5 5.5v-1c0 -0.53043 0.21071 -1.03914 0.58579 -1.41421C4.46086 2.71071 4.96957 2.5 5.5 2.5h4c0.5304 0 1.0391 -0.21071 1.4142 -0.58579C11.2893 1.53914 11.5 1.03043 11.5 0.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 5.5h-11c-0.552285 0 -1 0.44772 -1 1v6c0 0.5523 0.447715 1 1 1h11c0.5523 0 1 -0.4477 1 -1v-6c0 -0.55228 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10.75h3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 10.75h1m7 0h1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 8.25h1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.16669 8.25h1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.83331 8.25h1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 8.25h1" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function LinkIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m6 3 1.46436 -1.46447c1.38071 -1.380708 3.61924 -1.380708 5.00004 0 1.3807 1.38072 1.3807 3.61929 0 5.00001L11 8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.00001 11 -1.46435 1.4645c-1.38072 1.3807 -3.61929 1.3807 -5 0 -1.380717 -1.3807 -1.380716 -3.61932 0 -5.00004L3.00001 6" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 5 5 9" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ListBulletsIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1 3c0.27614 0 0.5 -0.22386 0.5 -0.5S1.27614 2 1 2c-0.276142 0 -0.5 0.22386 -0.5 0.5s0.223858 0.5 0.5 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 2.5h9" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 7.5c0.27614 0 0.5 -0.22386 0.5 -0.5s-0.22386 -0.5 -0.5 -0.5c-0.276142 0 -0.5 0.22386 -0.5 0.5s0.223858 0.5 0.5 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 7h9" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 12c0.27614 0 0.5 -0.2239 0.5 -0.5S1.27614 11 1 11c-0.276142 0 -0.5 0.2239 -0.5 0.5s0.223858 0.5 0.5 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 11.5h9" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function LockKeyIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M11 5.5H3c-0.55228 0 -1 0.44772 -1 1v6c0 0.5523 0.44772 1 1 1h8c0.5523 0 1 -0.4477 1 -1v-6c0 -0.55228 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 5.5V4c0 -0.92826 -0.3687 -1.8185 -1.02513 -2.47487C8.8185 0.868749 7.92826 0.5 7 0.5c-0.92826 0 -1.8185 0.368749 -2.47487 1.02513C3.86875 2.1815 3.5 3.07174 3.5 4v1.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10c0.27614 0 0.5 -0.22386 0.5 -0.5S7.27614 9 7 9s-0.5 0.22386 -0.5 0.5 0.22386 0.5 0.5 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function MagnifyingGlassIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M6 11.5c3.03757 0 5.5 -2.46243 5.5 -5.5S9.03757 0.5 6 0.5 0.5 2.96243 0.5 6s2.46243 5.5 5.5 5.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 13.5 10 10" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function MicrophoneStageIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  if (weight === "fill") {
    return (
      <SvgIcon weight={weight} {...props}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="currentColor"
          d="M2.25 1.5h9.5A1.5 1.5 0 0 1 13.25 3v6.25a1.5 1.5 0 0 1-1.5 1.5H6L3.1 13.1a.35.35 0 0 1-.57-.28v-2.07H2.25a1.5 1.5 0 0 1-1.5-1.5V3a1.5 1.5 0 0 1 1.5-1.5Zm1.4 2.75a.65.65 0 1 0 0 1.3h6.7a.65.65 0 1 0 0-1.3h-6.7Zm0 2.75a.65.65 0 1 0 0 1.3h4.3a.65.65 0 1 0 0-1.3h-4.3Z"
        />
      </SvgIcon>
    );
  }
  return (
    <SvgIcon weight={weight} {...props}>
      <path
        d="M2.25 1.75h9.5A1.25 1.25 0 0 1 13 3v6a1.25 1.25 0 0 1-1.25 1.25H6L3.15 12.6a.3.3 0 0 1-.5-.23v-2.12H2.25A1.25 1.25 0 0 1 1 9V3a1.25 1.25 0 0 1 1.25-1.25Z"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.75 4.75h6.5M3.75 7.35h4.25" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </SvgIcon>
  );
}

export function MusicNotesIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M4.25 13.5c1.38071 0 2.5 -1.1193 2.5 -2.5 0 -1.38071 -1.11929 -2.5 -2.5 -2.5s-2.5 1.11929 -2.5 2.5c0 1.3807 1.11929 2.5 2.5 2.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.75 11V0.5c0.72227 0 1.43747 0.142262 2.10476 0.418663 0.66729 0.276397 1.27364 0.681527 1.78434 1.192247 0.5107 0.51073 0.9158 1.11704 1.1922 1.78433 0.2764 0.66729 0.4187 1.38249 0.4187 2.10476" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function MusicNotesPlusIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M4.6453 11.0008c0.48584 0 0.87968 -0.3938 0.87968 -0.8797 0 -0.4858 -0.39384 -0.87964 -0.87968 -0.87964 -0.48583 0 -0.87968 0.39384 -0.87968 0.87964 0 0.4859 0.39385 0.8797 0.87968 0.8797Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.60234 9.9012c0.48583 0 0.87967 -0.39384 0.87967 -0.87968 0 -0.48583 -0.39384 -0.87967 -0.87967 -0.87967 -0.48584 0 -0.87968 0.39384 -0.87968 0.87967 0 0.48584 0.39384 0.87968 0.87968 0.87968Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.52539 10.1206V6.33795l3.95669 -0.93146v3.6154" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 12.2502V1.75018c0 -0.26522 0.105357 -0.51957 0.292893 -0.70711C0.98043 0.855537 1.23478 0.75018 1.5 0.75018h3.69c0.22843 -0.006655 0.45226 0.065133 0.63421 0.203414 0.18194 0.138276 0.31104 0.334706 0.36579 0.556586l0.31 1.24h6c0.2652 0 0.5196 0.10536 0.7071 0.29289 0.1875 0.18754 0.2929 0.44189 0.2929 0.70711v8.50002c0 0.2652 -0.1054 0.5196 -0.2929 0.7071s-0.4419 0.2929 -0.7071 0.2929h-11c-0.26522 0 -0.51957 -0.1054 -0.707107 -0.2929C0.605357 12.7698 0.5 12.5154 0.5 12.2502Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function PencilSimpleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M5 12.24 0.5 13.5l1.26 -4.49998L10 0.800021c0.0931 -0.095246 0.2044 -0.170925 0.3271 -0.222592 0.1228 -0.051668 0.2547 -0.078283 0.3879 -0.078283 0.1332 0 0.2651 0.026615 0.3879 0.078283 0.1227 0.051667 0.234 0.127346 0.3271 0.222592L13.2 2.58002c0.0937 0.09296 0.1681 0.20357 0.2189 0.32542 0.0508 0.12186 0.0769 0.25257 0.0769 0.38458 0 0.13201 -0.0261 0.26272 -0.0769 0.38458 -0.0508 0.12186 -0.1252 0.23246 -0.2189 0.32542L5 12.24Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function PlaylistIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1.25 3h9.5M1.25 6.75h9.5M1.25 10.5h5.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.25 8.5 13 10.75 9.25 13V8.5Z" fill="currentColor" stroke="currentColor" strokeWidth={0.6} strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function PlusIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M7 0.5v13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 6.95996h13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function QueueIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1.25 2.25 4.75 4.25 1.25 6.25V2.25Z" fill="currentColor" stroke="currentColor" strokeWidth={0.6} strokeLinejoin="round" />
      <path d="M6.75 4.25h6M1.25 8h11.5M1.25 11.75h11.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function RadioIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M12.5 4h-11c-0.552285 0 -1 0.44772 -1 1v7.5c0 0.5523 0.447715 1 1 1h11c0.5523 0 1 -0.4477 1 -1V5c0 -0.55228 -0.4477 -1 -1 -1Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.37 4 13.5 0.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 11.5c0.82843 0 1.5 -0.6716 1.5 -1.5 0 -0.82843 -0.67157 -1.5 -1.5 -1.5S3 9.17157 3 10c0 0.8284 0.67157 1.5 1.5 1.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 8.75H11" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 11.25H11" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 6.5h13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function RepeatIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1.75 6.25V5.25A2.25 2.25 0 0 1 4 3h7.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.75 1.25 11.75 3 9.75 4.75" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.25 7.75V8.75A2.25 2.25 0 0 1 10 11H2.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.25 9.25 2.25 11 4.25 12.75" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ShuffleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m11.5 2 2 2 -2 2" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 4h5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m11.5 8 2 2 -2 2" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 4H4l4 6h5.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 10H4" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function SidebarSimpleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M13.5 1H8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 4H8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 7H8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 13H8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 10H8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m0.5 1.5 0 4c0 0.27614 0.223858 0.5 0.5 0.5h4c0.27614 0 0.5 -0.22386 0.5 -0.5v-4c0 -0.27614 -0.22386 -0.5 -0.5 -0.5H1c-0.276142 0 -0.5 0.22386 -0.5 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m0.5 8.5 0 4c0 0.2761 0.223858 0.5 0.5 0.5h4c0.27614 0 0.5 -0.2239 0.5 -0.5v-4c0 -0.27614 -0.22386 -0.5 -0.5 -0.5H1c-0.276142 0 -0.5 0.22386 -0.5 0.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function SpeakerHighIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M12.4951 10.5c0.6397 -1.05652 0.985 -2.265 1 -3.5 -0.015 -1.235 -0.3603 -2.44348 -1 -3.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 5.5c0.3476 0.42029 0.5259 0.95518 0.5 1.5 0.0259 0.54482 -0.1524 1.07971 -0.5 1.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 5.00002H1.5c-0.544667 0 -1 0.45533 -1 1v2c0 0.54466 0.455333 1 1 1H3L6.91 11.81c0.6453 0.4465 1.57254 -0.0236 1.59 -0.81V3c0.01874 -0.78684 -0.8529 -1.25773 -1.5 -0.81L3 5.00002Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function SpeakerLowIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M10.5 5.5c0.3476 0.42029 0.5259 0.95518 0.5 1.5 0.0259 0.54482 -0.1524 1.07971 -0.5 1.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 5.00002H1.5c-0.544667 0 -1 0.45533 -1 1v2c0 0.54466 0.455333 1 1 1H3L6.91 11.81c0.6453 0.4465 1.57254 -0.0236 1.59 -0.81V3c0.01874 -0.78684 -0.8529 -1.25773 -1.5 -0.81L3 5.00002Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function SpeakerXIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m13.5 5.5 -3 3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m10.5 5.5 3 3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 5.00002H1.5c-0.544667 0 -1 0.45533 -1 1v2c0 0.54466 0.455333 1 1 1H3L6.91 11.81c0.6453 0.4465 1.57254 -0.0236 1.59 -0.81V3c0.01874 -0.78684 -0.8529 -1.25773 -1.5 -0.81L3 5.00002Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function SwapIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m0.5 10.5 10 -10H6" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.5 3.5 -10 10H8" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function SwatchesIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1.5 0.5h3c0.26522 0 0.51957 0.105357 0.70711 0.292893C5.39464 0.98043 5.5 1.23478 5.5 1.5V11c0 0.663 -0.26339 1.2989 -0.73223 1.7678C4.29893 13.2366 3.66304 13.5 3 13.5v0c-0.3283 0 -0.65339 -0.0647 -0.95671 -0.1903 -0.30331 -0.1256 -0.57891 -0.3098 -0.81106 -0.5419C0.763392 12.2989 0.5 11.663 0.5 11V1.5c0 -0.26522 0.105357 -0.51957 0.292893 -0.707107C0.98043 0.605357 1.23478 0.5 1.5 0.5v0Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5.50002 5 3.5 -3.52c0.18736 -0.18625 0.44081 -0.29079 0.705 -0.29079s0.51768 0.10454 0.70498 0.29079l2.11 2.12c0.1863 0.18736 0.2908 0.44082 0.2908 0.705 0 0.26419 -0.1045 0.51764 -0.2908 0.705l-7.74998 7.76" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 8.5h3.5c0.2652 0 0.5196 0.10536 0.7071 0.29289 0.1875 0.18754 0.2929 0.44189 0.2929 0.70711v3c0 0.2652 -0.1054 0.5196 -0.2929 0.7071s-0.4419 0.2929 -0.7071 0.2929H3" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 4.5h5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M0.5 8.5h5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function TrashIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1 3.5h12" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 3.5h9v9c0 0.2652 -0.1054 0.5196 -0.2929 0.7071s-0.4419 0.2929 -0.7071 0.2929h-7c-0.26522 0 -0.51957 -0.1054 -0.70711 -0.2929C2.60536 13.0196 2.5 12.7652 2.5 12.5v-9Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 3.5V3c0 -0.66304 0.26339 -1.29893 0.73223 -1.76777C5.70107 0.763392 6.33696 0.5 7 0.5c0.66304 0 1.29893 0.263392 1.76777 0.73223C9.23661 1.70107 9.5 2.33696 9.5 3v0.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 6.50146V10.503" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 6.50146V10.503" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function UploadSimpleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M12.5 12.5c0 0.2652 -0.1054 0.5196 -0.2929 0.7071s-0.4419 0.2929 -0.7071 0.2929h-9c-0.26522 0 -0.51957 -0.1054 -0.70711 -0.2929C1.60536 13.0196 1.5 12.7652 1.5 12.5v-11c0 -0.26522 0.10536 -0.51957 0.29289 -0.707107C1.98043 0.605357 2.23478 0.5 2.5 0.5H9L12.5 4v8.5Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 6.5 -2 -2 -2 2" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4.5 7 10" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function VideoCameraIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  const fill = weight === "fill" ? "currentColor" : "none";
  return (
    <SvgIcon weight={weight} {...props}>
      <rect x="0.75" y="3.25" width="8.5" height="7.5" rx="1.6" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
      <path d="M9.25 5.6 13.25 3.6v6.8l-4-2V5.6Z" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function VideoCameraSlashIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1.5 4c-0.26522 0 -0.51957 0.10536 -0.707107 0.29289C0.605357 4.48043 0.5 4.73478 0.5 5v6c0 0.2652 0.105357 0.5196 0.292893 0.7071C0.98043 11.8946 1.23478 12 1.5 12h8.21875" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.67865 5.67866c0.37102 -0.26963 0.82761 -0.42866 1.32134 -0.42866 1.24264 0 2.25 1.00736 2.25 2.25 0 0.49373 -0.15903 0.95032 -0.42866 1.32134" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.71429 3.71429 5.00001 2h4L10.5 4h2c0.2652 0 0.5196 0.10536 0.7071 0.29289 0.1876 0.18754 0.2929 0.44189 0.2929 0.70711v6c0 0.2652 -0.1053 0.5196 -0.2929 0.7071 -0.1875 0.1875 -0.4419 0.2929 -0.7071 0.2929H12" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.77784 7.14502c-0.01832 0.11563 -0.02784 0.23418 -0.02784 0.35496 0 1.24264 1.00736 2.25 2.25 2.25 0.12078 0 0.23934 -0.00951 0.35496 -0.02784" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 13.5 0.5 0.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function WarningCircleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M7.89003 1.0499C7.80611 0.886097 7.67861 0.748632 7.52158 0.652642 7.36455 0.556651 7.18407 0.505859 7.00003 0.505859c-0.18405 0 -0.36453 0.050792 -0.52156 0.146783 -0.15703 0.09599 -0.28453 0.233455 -0.36844 0.397258l-5.500004 11c-0.07671 0.1522 -0.113232 0.3215 -0.106098 0.4919 0.007134 0.1703 0.057688 0.3359 0.146861 0.4812 0.089172 0.1453 0.214003 0.2654 0.362641 0.3488 0.14863 0.0835 0.31613 0.1276 0.4866 0.1281H12.5c0.1705 -0.0005 0.338 -0.0446 0.4866 -0.1281 0.1487 -0.0834 0.2735 -0.2035 0.3627 -0.3488 0.0891 -0.1453 0.1397 -0.3109 0.1468 -0.4812 0.0072 -0.1704 -0.0294 -0.3397 -0.1061 -0.4919l-5.49997 -11Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 5v3.25" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11c-0.13807 0 -0.25 -0.1119 -0.25 -0.25s0.11193 -0.25 0.25 -0.25" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11c0.13807 0 0.25 -0.1119 0.25 -0.25s-0.11193 -0.25 -0.25 -0.25" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function WaveformIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M0.5 7.0799h2.19c0.09221 -0.00106 0.18248 -0.02662 0.26156 -0.07407 0.07907 -0.04744 0.14411 -0.11506 0.18844 -0.19593l1.8 -3.6c0.04436 -0.08963 0.11509 -0.16354 0.20268 -0.2118 0.08759 -0.04827 0.18785 -0.06858 0.28732 -0.0582 0.09907 0.0067 0.19363 0.04395 0.27064 0.10664 0.07702 0.06268 0.13269 0.14771 0.15936 0.24336l2.23 7.42c0.02926 0.1007 0.08942 0.1896 0.17196 0.2542 0.08255 0.0646 0.18331 0.1016 0.28804 0.1058 0.09814 -0.0033 0.19315 -0.0353 0.27318 -0.0922 0.08003 -0.057 0.14152 -0.1362 0.17682 -0.2278l1.37 -3.35c0.0377 -0.09397 0.1026 -0.17459 0.1863 -0.23158 0.0837 -0.05698 0.1824 -0.08777 0.2837 -0.08842h2.66" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function XIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="m13.5 0.5 -13 13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="m0.5 0.5 13 13" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CaretLeftIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M8.75 3 4.75 7l4 4" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CaretRightIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M5.25 3 9.25 7l-4 4" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CaretDownIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M3 5.25 7 9.25l4-4" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CaretUpIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M3 8.75 7 4.75l4 4" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowSquareOutIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M5.5 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 1.25h4.25V5.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.25 7.75 12.75 1.25" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ArrowUpLeftIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M10.75 10.75 3.25 3.25" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.75 3.25h-5.5v5.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CheckCircleIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  if (weight === "fill") {
    return (
      <SvgIcon weight={weight} {...props}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="currentColor"
          d="M7 0.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.15 4.45a.65.65 0 0 1 .08.92l-3.65 4.4a.75.75 0 0 1-1.15 0L3.82 8.4a.65.65 0 1 1 .98-.86l1.21 1.38 3.16-3.81a.65.65 0 0 1 .98-.16Z"
        />
      </SvgIcon>
    );
  }
  return (
    <SvgIcon weight={weight} {...props}>
      <circle cx="7" cy="7" r="6.25" stroke="currentColor" strokeWidth={sw} />
      <path d="M4.2 7.3 6.1 9.5l3.7-4.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function CircleNotchIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M7 1a6 6 0 1 1-4.24 1.76" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </SvgIcon>
  );
}

export function DotsThreeIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="2.75" cy="7" r="1.1" fill="currentColor" />
      <circle cx="7" cy="7" r="1.1" fill="currentColor" />
      <circle cx="11.25" cy="7" r="1.1" fill="currentColor" />
    </SvgIcon>
  );
}

export function RepeatOnceIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1.75 6.25V5.25A2.25 2.25 0 0 1 4 3h7.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.75 1.25 11.75 3 9.75 4.75" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.25 7.75V8.75A2.25 2.25 0 0 1 10 11H2.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.25 9.25 2.25 11 4.25 12.75" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.1 5.75 7.25 4.85v4.3" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export function ListPlusIcon({ weight, ...props }: IconProps) {
  const sw = strokeW(weight);
  return (
    <SvgIcon weight={weight} {...props}>
      <path d="M1.5 3h9M1.5 6.5h9M1.5 10h5.5M10.5 8.5v4M8.5 10.5h4" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  );
}

export const CornersOutIcon = ArrowsOutIcon;
export const ListIcon = ListBulletsIcon;
