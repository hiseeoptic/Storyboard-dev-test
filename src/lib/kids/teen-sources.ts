// Evidence register for the 13–15 library.  A lesson cites source ids instead
// of putting an impressive-sounding programme name in `method` with no trail.

export const TEEN_EVIDENCE_SOURCES = {
  unicef_adolescent_parenting_2021: {
    publisher: "UNICEF",
    year: 2021,
    title: "Parenting of Adolescents Programming Guidance",
    url: "https://www.unicef.org/documents/parenting-adolescents-programming-guidance",
    locator: "Evidence-based programming; developmentally appropriate support, connection and adolescent agency",
    scope: "global",
  },
  who_unicef_hat_2021: {
    publisher: "WHO & UNICEF",
    year: 2021,
    title: "Helping Adolescents Thrive Toolkit",
    url: "https://www.who.int/publications/i/item/9789240025554",
    locator: "172-page toolkit; parent/caregiver support and psychosocial skills strategies",
    scope: "global",
  },
  who_plh_teens: {
    publisher: "WHO, UNICEF and partners",
    year: 2020,
    title: "Parenting for Lifelong Health for Parents and Teens",
    url: "https://www.who.int/teams/social-determinants-of-health/parenting-for-lifelong-health/parents-and-teens",
    locator: "Programme delivery: quality time, praise, anger, rules, responsibilities, budgeting and joint problem-solving",
    scope: "multi-country",
  },
  cdc_parental_monitoring_2024: {
    publisher: "US Centers for Disease Control and Prevention",
    year: 2024,
    title: "Parental Monitoring",
    url: "https://www.cdc.gov/healthy-youth-parent-resources/positive-parental-practices/parental-monitoring.html",
    locator: "Expectations, check-ins and fair follow-through within an open and caring relationship",
    scope: "international reference",
  },
  aap_digital_ecosystems_2026: {
    publisher: "American Academy of Pediatrics",
    year: 2026,
    title: "Digital Ecosystems, Children, and Adolescents: Policy Statement",
    url: "https://publications.aap.org/pediatrics/article/157/2/e2025075320/206129/",
    locator: "pp. 6–8: Family Media Plan, sleep, shared boundaries, privacy and safety",
    scope: "international clinical reference",
  },
  unicef_cyberbullying: {
    publisher: "UNICEF Parenting",
    year: 2025,
    title: "How to talk to your child about cyberbullying",
    url: "https://www.unicef.org/parenting/child-care/what-to-do-if-your-child-is-experiencing-cyberbullying",
    locator: "Age 10–13 and 14–18 guidance: non-judgmental check-ins, block, report, preserve evidence and seek adult help",
    scope: "global",
  },
  oecd_youth_finance_2023: {
    publisher: "European Union & OECD",
    year: 2023,
    title: "Financial competence framework for children and youth in the European Union",
    url: "https://doi.org/10.1787/bf059471-en",
    locator: "49-page framework: money and transactions; planning; risk and reward; financial landscape",
    scope: "international",
  },
  unesco_miltiverse_2024: {
    publisher: "UNESCO",
    year: 2024,
    title: "Journey through the MILtiverse: media and information literacy toolkit for youth organizations",
    url: "https://www.unesco.org/en/articles/journey-through-miltiverse",
    locator: "Critical engagement with information, disinformation, harmful content and emerging technology",
    scope: "global",
  },
  crc_general_comment_20_2016: {
    publisher: "UN Committee on the Rights of the Child",
    year: 2016,
    title: "General Comment No. 20 on the implementation of the rights of the child during adolescence",
    url: "https://digitallibrary.un.org/record/855544/files/CRC_C_GC_20-EN.pdf",
    locator: "paras. 1–7: dignity, agency, participation and evolving capacities of adolescents",
    scope: "global rights framework",
  },
  unicef_vietnam_teen_stress_2021: {
    publisher: "UNICEF Viet Nam",
    year: 2021,
    title: "How to support your teen during stressful times",
    url: "https://www.unicef.org/vietnam/stories/how-support-your-teen-during-stressful-times",
    locator: "Feelings, achievable routines, autonomy, calm conflict and collaborative solutions",
    scope: "Vietnam",
  },
  unicef_vietnam_mental_health: {
    publisher: "UNICEF Viet Nam",
    year: 2024,
    title: "Mental Health: For every child, mental wellness",
    url: "https://www.unicef.org/vietnam/mental-health",
    locator: "Vietnam context: nurturing homes, socio-emotional learning, resilience and referral to support",
    scope: "Vietnam",
  },
  who_vietnam_gshs_2019: {
    publisher: "WHO Western Pacific",
    year: 2022,
    title: "Report of the 2019 global school-based student health survey in Viet Nam",
    url: "https://www.who.int/publications/i/item/9789290619376",
    locator: "104-page report on students aged 13–17: diet, mental health, activity, protective factors, violence and injury",
    scope: "Vietnam",
  },
} as const;

export type TeenEvidenceSourceId = keyof typeof TEEN_EVIDENCE_SOURCES;

export function teenEvidenceSource(id: TeenEvidenceSourceId) {
  return TEEN_EVIDENCE_SOURCES[id];
}
