# calculate_matches.py
import firebase_admin
from firebase_admin import credentials, firestore
import numpy as np
from typing import List, Dict, Tuple, Set

class EnhancedMatcher:
    def __init__(
            self,
            cred_path: str,
            weights: Dict = None
    ):
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        self.db = firestore.client()

        self.component_weights = {
            'core_match': 0.90,
            'background_match': 0.05,
            'cultural_match': 0.05,
        }

        self.core_weights = {
            'skills': 0.50,
            'personality': 0.50
        }

        self.skill_weights = {
            'primary': 0.75,
            'secondary': 0.25
        }

        self.background_weights = {
            'education': 0.50,
            'industry': 0.50
        }

        self.cultural_weights = {
            'values': 0.50,
            'interests': 0.50
        }

        self.personality_weights = {
            'openness': 0.25,
            'conscientiousness': 0.25,
            'extraversion': 0.15,
            'agreeableness': 0.20,
            'neuroticism': 0.15
        }

        self.industry_skills_map = {
            'Fintech': {
                'primary': {'Full-Stack', 'Back-End', 'Cloud', 'Networks & Distributed Systems', 'Cyber Security'},
                'secondary': {'DevOps', 'Data Science', 'UI/UX'}
            },
            'Blockchain': {
                'primary': {'Back-End', 'Networks & Distributed Systems', 'Cyber Security'},
                'secondary': {'Full-Stack', 'Cloud', 'DevOps'}
            },
            'AI/ML': {
                'primary': {'Data Science', 'Artificial Intelligence', 'Back-End'},
                'secondary': {'Cloud', 'DevOps', 'Full-Stack'}
            },
            'E-commerce': {
                'primary': {'Full-Stack', 'Front-End', 'Back-End', 'UI/UX'},
                'secondary': {'Cloud', 'DevOps', 'Data Science'}
            },
            'HealthTech': {
                'primary': {'Back-End', 'Data Science', 'Cyber Security'},
                'secondary': {'Full-Stack', 'UI/UX', 'Cloud'}
            },
            'EdTech': {
                'primary': {'Full-Stack', 'Front-End', 'UI/UX'},
                'secondary': {'Back-End', 'Data Science', 'Cloud'}
            },
            'Gaming': {
                'primary': {'Game-Development', 'Graphics Programming', 'Desktop Applications'},
                'secondary': {'Full-Stack', 'UI/UX', 'Back-End'}
            },
            'IoT': {
                'primary': {'Embedded Systems', 'Networks & Distributed Systems', 'Back-End'},
                'secondary': {'Cloud', 'DevOps', 'Data Science'}
            },
            'Cybersecurity': {
                'primary': {'Cyber Security', 'Networks & Distributed Systems', 'Back-End'},
                'secondary': {'Cloud', 'DevOps', 'Data Science'}
            },
            'Web3': {
                'primary': {'Back-End', 'Networks & Distributed Systems', 'Cyber Security'},
                'secondary': {'Full-Stack', 'Cloud', 'DevOps'}
            },
            'SaaS': {
                'primary': {'Full-Stack', 'Cloud', 'DevOps'},
                'secondary': {'Back-End', 'Front-End', 'UI/UX'}
            },
            'AR/VR': {
                'primary': {'Graphics Programming', 'Game-Development', 'UI/UX'},
                'secondary': {'Full-Stack', 'Front-End', 'Back-End'}
            },
            'Digital Health': {
                'primary': {'Back-End', 'Data Science', 'Cyber Security'},
                'secondary': {'Full-Stack', 'UI/UX', 'Cloud'}
            },
            'CleanTech': {
                'primary': {'Data Science', 'Back-End', 'Embedded Systems'},
                'secondary': {'Full-Stack', 'Cloud', 'DevOps'}
            },
            'Smart Cities': {
                'primary': {'IoT', 'Networks & Distributed Systems', 'Data Science'},
                'secondary': {'Cloud', 'DevOps', 'Back-End'}
            }
        }

        self.default_skills = {
            'primary': {'Full-Stack', 'Back-End', 'Front-End'},
            'secondary': {'Cloud', 'DevOps', 'UI/UX'}
        }

        self.industry_aliases = {
            'GreenTech': 'CleanTech',
            'Green Tech': 'CleanTech',
            'Green Technology': 'CleanTech'
        }

    def _update_nested_dict(self, d: Dict, u: Dict) -> Dict:
        for k, v in u.items():
            if isinstance(v, dict) and k in d and isinstance(d[k], dict):
                self._update_nested_dict(d[k], v)
            else:
                d[k] = v
        return d

    def extract_working_field(self, about: str, long_description: str) -> str:
        text = f"{about or ''} {long_description or ''}"

        for industry in self.industry_skills_map.keys():
            search_terms = industry.replace('/', ' ').split()
            if all(term.lower() in text.lower() for term in search_terms):
                return industry

        for alias, industry in self.industry_aliases.items():
            if alias.lower() in text.lower():
                return industry

        return None

    def calculate_skill_match(self, founder: Dict, developer: Dict) -> float:
        working_field = self.extract_working_field(
            founder.get('about', ''),
            founder.get('longDescription', '')
        )

        if not working_field:
            return 0.0

        dev_skills = set(developer.get('skills', []))
        if not dev_skills:
            return 0.0

        if working_field in self.industry_skills_map:
            primary_skills = self.industry_skills_map[working_field]['primary']
            secondary_skills = self.industry_skills_map[working_field]['secondary']
        else:
            primary_skills = self.default_skills['primary']
            secondary_skills = self.default_skills['secondary']

        primary_coverage = len(primary_skills.intersection(dev_skills)) / len(primary_skills) if primary_skills else 0
        secondary_coverage = len(secondary_skills.intersection(dev_skills)) / len(
            secondary_skills) if secondary_skills else 0

        weighted_score = (
                self.skill_weights['primary'] * primary_coverage +
                self.skill_weights['secondary'] * secondary_coverage
        )

        tech_skills = dev_skills - (primary_skills.union(secondary_skills))
        tech_bonus = len(tech_skills) * 0.05

        return min(1.0, weighted_score + tech_bonus)

    def calculate_personality_match(self, founder: Dict, developer: Dict) -> float:
        founder_personality = founder.get('personalityResults', {})
        developer_personality = developer.get('personalityResults', {})

        if not founder_personality or not developer_personality:
            return 0.0

        scores = {}

        f_openness = founder_personality.get('openness', 0)
        d_openness = developer_personality.get('openness', 0)
        diff_openness = abs(f_openness - d_openness)
        scores['openness'] = max(0, 1 - (diff_openness / 20))

        f_conscientiousness = founder_personality.get('conscientiousness', 0)
        d_conscientiousness = developer_personality.get('conscientiousness', 0)
        diff_conscientiousness = abs(f_conscientiousness - d_conscientiousness)
        scores['conscientiousness'] = max(0, 1 - (diff_conscientiousness / 20))

        f_extraversion = founder_personality.get('extraversion', 0)
        d_extraversion = developer_personality.get('extraversion', 0)
        extraversion_sum = f_extraversion + d_extraversion
        scores['extraversion'] = max(0, 1 - abs(35 - extraversion_sum) / 35)

        f_agreeableness = founder_personality.get('agreeableness', 0)
        d_agreeableness = developer_personality.get('agreeableness', 0)
        diff_agreeableness = abs(f_agreeableness - d_agreeableness)
        scores['agreeableness'] = max(0, 1 - (diff_agreeableness / 20))

        f_neuroticism = founder_personality.get('neuroticism', 0)
        d_neuroticism = developer_personality.get('neuroticism', 0)
        combined_neuroticism = (f_neuroticism + d_neuroticism) / 2
        scores['neuroticism'] = max(0, 1 - (combined_neuroticism / 30))

        for trait in ['openness', 'conscientiousness', 'agreeableness']:
            if abs(founder_personality.get(trait, 0) - developer_personality.get(trait, 0)) > 30:
                scores[trait] *= 0.5

        final_score = sum(scores[trait] * self.personality_weights[trait] for trait in scores)
        scaled_score = pow(final_score, 1.5)

        return min(1.0, scaled_score)

    def calculate_background_match(self, founder: Dict, developer: Dict) -> float:
        founder_degrees = set(' '.join(founder.get('degrees', [])).lower().split())
        developer_degrees = set(' '.join(developer.get('degrees', [])).lower().split())

        technical_fields = {'engineering', 'computer', 'data', 'statistics', 'mathematics', 'robotics'}
        business_fields = {'business', 'management', 'mba', 'economics', 'finance'}

        founder_technical = any(field in ' '.join(founder_degrees) for field in technical_fields)
        founder_business = any(field in ' '.join(founder_degrees) for field in business_fields)
        developer_technical = any(field in ' '.join(developer_degrees) for field in technical_fields)

        education_score = 1.0 if (founder_business and developer_technical) or (
                    founder_technical and developer_technical) else 0.6

        founder_industries = set(founder.get('industries', []))
        developer_industries = set(developer.get('industries', []))
        industry_overlap = len(founder_industries.intersection(developer_industries)) / max(
            len(founder_industries | developer_industries), 1)

        return (education_score * self.background_weights['education'] +
                industry_overlap * self.background_weights['industry'])

    def calculate_cultural_match(self, founder: Dict, developer: Dict) -> float:
        founder_companies = set(founder.get('companies', []))
        developer_companies = set(developer.get('companies', []))
        company_overlap = len(founder_companies.intersection(developer_companies)) / max(
            len(founder_companies | developer_companies), 1)

        founder_personalities = set(founder.get('admiringpersonalities', []))
        developer_personalities = set(developer.get('admiringpersonalities', []))
        personality_overlap = len(founder_personalities.intersection(developer_personalities)) / max(
            len(founder_personalities | developer_personalities), 1)

        values_score = (company_overlap + personality_overlap) / 2

        founder_hobbies = set(founder.get('hobbies', []))
        developer_hobbies = set(developer.get('hobbies', []))

        founder_hobbies = {hobby.lower() for hobby in founder_hobbies}
        developer_hobbies = {hobby.lower() for hobby in developer_hobbies}

        hobby_overlap = len(founder_hobbies.intersection(developer_hobbies)) / max(
            len(founder_hobbies | developer_hobbies), 1)

        active_hobbies = {'climbing', 'hiking', 'biking', 'surfing', 'martial', 'sports'}
        founder_active = any(any(active in hobby for active in active_hobbies) for hobby in founder_hobbies)
        developer_active = any(any(active in hobby for active in active_hobbies) for hobby in developer_hobbies)

        interests_score = min(1.0, hobby_overlap + (0.2 if founder_active and developer_active else 0))

        return (values_score * self.cultural_weights['values'] +
                interests_score * self.cultural_weights['interests'])

    def calculate_match_score(self, founder: Dict, developer: Dict) -> Dict:
        skill_score = self.calculate_skill_match(founder, developer)
        personality_score = self.calculate_personality_match(founder, developer)
        core_score = (skill_score * self.core_weights['skills'] +
                      personality_score * self.core_weights['personality'])

        background_score = self.calculate_background_match(founder, developer)
        cultural_score = self.calculate_cultural_match(founder, developer)

        total_score = (
                core_score * self.component_weights['core_match'] +
                background_score * self.component_weights['background_match'] +
                cultural_score * self.component_weights['cultural_match']
        )

        return {
            'total_score': round(total_score * 100, 2),
            'components': {
                'core_score': round(core_score * 100, 2),
                'skill_score': round(skill_score * 100, 2),
                'personality_score': round(personality_score * 100, 2),
                'background_score': round(background_score * 100, 2),
                'cultural_score': round(cultural_score * 100, 2)
            }
        }

    def find_matches(self, founder: Dict, developers: List[Dict], min_score: float = 30.0) -> List[Tuple[Dict, Dict]]:
        matches = []

        working_field = self.extract_working_field(
            founder.get('about', ''),
            founder.get('longDescription', '')
        )

        if working_field in self.industry_skills_map:
            primary_skills = self.industry_skills_map[working_field]['primary']
            secondary_skills = self.industry_skills_map[working_field]['secondary']
        else:
            primary_skills = self.default_skills['primary']
            secondary_skills = self.default_skills['secondary']

        print(f"\nRequired skills for {working_field}:")
        print(f"Primary ({self.skill_weights['primary'] * 100}% weight): {', '.join(primary_skills)}")
        print(f"Secondary ({self.skill_weights['secondary'] * 100}% weight): {', '.join(secondary_skills)}")

        for developer in developers:
            match_results = self.calculate_match_score(founder, developer)
            if match_results['total_score'] >= min_score:
                matches.append((developer, match_results))

        matches.sort(key=lambda x: x[1]['total_score'], reverse=True)
        return matches

def main():
    cred_path = "../firebase-credentials.json"
    matcher = EnhancedMatcher(cred_path)

    users = matcher.db.collection('hackathonusers').get()
    founders = []
    developers = []

    for user in users:
        data = user.to_dict()
        if data['role'] == 'founder / entrepreneur':
            founders.append(data)
        elif data['role'] == 'softwareEngineer':
            developers.append(data)

    if founders and developers:
        founder = founders[0]
        print(f"\nFinding matches for founder: {founder['name']}")

        matches = matcher.find_matches(founder, developers)
        print("\nTop Matches:")
        for dev, match_results in matches:
            print(f"\nDeveloper: {dev['name']}")
            print(f"Skills: {', '.join(dev.get('skills', []))}")
            print(f"Total Score: {match_results['total_score']}%")
            print("Component Scores:")
            print(f"- Core Score: {match_results['components']['core_score']}%")
            print(f"  • Skill Match: {match_results['components']['skill_score']}%")
            print(f"  • Personality Match: {match_results['components']['personality_score']}%")
            print(f"- Background Score: {match_results['components']['background_score']}%")
            print(f"- Cultural Score: {match_results['components']['cultural_score']}%")


if __name__ == "__main__":
    main()