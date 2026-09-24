# Anywork365 visual system

## Reference audit — 24 September 2026

Reviewed all fifteen supplied mobile references before changing UI code. These are visual references, not specifications for product behaviour. We retain Anywork365's name, logo, teal palette, account roles and existing workflows.

| Reference (filename time/suffix) | Useful observation | Anywork365 translation |
| --- | --- | --- |
| 7.38.44 (1) | Strong left-aligned upgrade heading; small dimensional lock; confident full-width actions | Short task headings, a single meaningful illustration and tactile primary actions |
| 7.38.44 (2) | Rounded sheet, subtle handle, clear sections and expanding selected navigation | Spacious sheets; compact segmented filters with unmistakable selection |
| 7.38.44 (3) | One centred house illustration anchors a quiet card | Illustrations explain empty states without extra decorative panels |
| 7.38.44 | Inbox uses generous whitespace, dark selected pills and a mailbox | One shared empty-state layout with a contextual object and concise copy |
| 7.38.45 (1) | Repeating card rhythm; headings clearly separate stacked sections | Consistent gutters and section spacing, no gratuitous nested cards |
| 7.38.45 (2) | Readable avatar row; status in words; contextual wallet promotion | Preserve real status labels; separate functional information from illustration |
| 7.38.45 (3) | Soft modal over dim background; map illustration connects to its task | Original work-community artwork; clear bottom action and focused dialog |
| 7.38.45 | Restrained places card with large secondary action | Neutral secondary buttons; one elevation level per surface |
| 7.38.46 (1) | Notification examples explain a permission before the action | Clear contextual descriptions, not invented permission or success claims |
| 7.38.46 (2) | Friendly adult 3D characters; readable text and intentional bold emphasis | Original Nigerian work-community characters for welcome and onboarding |
| 7.38.46 (3) | Rounded close control, restrained illustration and tiny progress indicators | Accessible close controls and quiet step progress |
| 7.38.46 | Floating pin and strong lower sheet establish spatial hierarchy | Location artwork only in discovery; solid surfaces for forms |
| 7.38.47 (1) | Dimensional home and people are combined with flat UI | Keep inputs, labels and dense data flat; illustration remains storytelling |
| 7.38.47 | Simple path, avatar and relevant information avoid visual clutter | No ornamental blobs, fake statistics or floating fake activity |
| 7.38.48 | Bold welcome statement, large coherent scene, obvious main action | Responsive home hero, original work illustration, real search and signup actions |

The references use a rounded geometric sans, heavy compact headings, comfortably sized body copy, large radii on major surfaces and shorter radii on controls. Primary buttons have a gentle top highlight and a grounded lower shadow. White and warm off-white dominate; colour is sparse. Illustrations share soft matte materials, broad lighting and rounded silhouettes. Navigation and information remain flat. We translate these relationships, not the source application's purple branding, characters, copy or layouts.

## Existing application audit

Next.js App Router, React and Tailwind already provide a shared UI layer. Plus Jakarta Sans supports the intended typography without another font download. Existing CSS button, form and card classes are used across marketplace, dashboards, booking/quotes, wallet, account forms and administration. There are duplicate empty-state components, isolated hard-coded shadows/radii, ornamental radial backgrounds and mobile navigation with an oversized unlabelled chat action. Those are the principal consistency gaps.

Preserve Firebase/session authentication, server routes, MySQL queries, financial state, quote/booking associations, location permissions, chat state and role-specific routing. No schema change is required. Existing uncommitted signup/profile copy and chat fixes are retained.

## Foundations

- **Colour:** brand teal `#0f4f4a`; dark ink `#202724`; warm canvas `#f7f8f5`; white surface; muted sage secondary surface. Honey is an occasional supporting accent, never a success indicator. Semantic success, warning, error and information colours always accompany words or icons.
- **Type:** Plus Jakarta Sans. Display 36–64px/1.08, page title 30–44px/1.15, section 24–30px/1.2, card title 18–22px/1.3; body 16px/1.6, supporting 14px/1.5, caption 12px/1.5. Headings 800, controls 700. Dense operational screens may use 14px body text.
- **Space:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px. Mobile gutters 20px (16px on narrow forms); desktop 24–32px. Section gaps 32–48px. Surface padding 20–32px.
- **Radii:** compact 12px, input/control 16px, card 24px, major surface 32px, sheet 36px; pills only for tabs and badges.
- **Elevation:** 0 flat; 1 subtle border/contact; 2 diffuse raised card; 3 menu; 4 dialog. Primary buttons have their own restrained inset highlight/contact shadow. No neon glow or blanket glassmorphism.
- **Motion:** 160–220ms colour/elevation/press transitions; press moves down 1px. Reduced-motion removes transforms and animation. No decorative infinite motion.
- **Icons:** retain the existing rounded outline SVG vocabulary, 20–24px navigation, 16–20px inline, approximately 1.8–2px stroke. Do not replace real profile photos with illustrated avatars.

## Usage rules

Use shared `Button`, `Input`, `Select`, `Textarea`, `Modal`, `EmptyState`, `SectionHeader`, and `StoryArt` components, or their documented CSS classes when rendering links. Keep cards purposeful. Primary actions are teal; destructive actions red; secondary actions neutral. Loading and disabled controls must remain recognisable and not react to press. Errors must be associated with their fields. Dialogs sit above navigation, trap keyboard focus, restore focus and allow Escape. Mobile page clearance must match the bottom navigation including safe-area insets.

Original 3D artwork belongs on welcome/onboarding and contextual empty states. Never use it as evidence of an actual person, verified status, payment, review or completed task. Artwork is decorative when adjacent copy conveys the meaning. Payment confirmations still depend on the existing server-confirmed state.

## Validation

Record automated checks and actual browser coverage at the end of implementation. Authenticated production records must not be edited merely to obtain screenshots.
