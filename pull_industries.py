import firebase_admin
from firebase_admin import credentials, firestore
from collections import Counter
import json
from datetime import datetime


def initialize_firebase():
    """Initialize Firebase if not already initialized"""
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate('firebase-credentials.json')
            firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return None


def extract_industries_from_firebase():
    """Extract and analyze all industries from Firebase users"""
    db = initialize_firebase()
    if not db:
        return None

    try:
        # Get all users from the hackathonusers collection
        users = db.collection('hackathonusers').get()

        # Initialize counters and sets
        all_industries = set()
        industry_frequency = Counter()
        industries_by_role = {
            'founder': set(),
            'developer': set()
        }
        user_industry_mapping = []

        # Process each user
        for user in users:
            user_data = user.to_dict()
            user_industries = user_data.get('industries', [])
            role = 'founder' if user_data.get('role') == 'founder / entrepreneur' else 'developer'

            # Add to sets and counter
            all_industries.update(user_industries)
            industry_frequency.update(user_industries)
            industries_by_role[role].update(user_industries)

            # Add to user-industry mapping
            if user_industries:
                user_industry_mapping.append({
                    'user_id': user.id,
                    'name': user_data.get('name', 'Unknown'),
                    'role': role,
                    'industries': user_industries
                })

        # Prepare analysis results
        results = {
            'metadata': {
                'total_unique_industries': len(all_industries),
                'extraction_date': datetime.now().isoformat(),
                'total_users_analyzed': len(user_industry_mapping)
            },
            'industry_stats': {
                'all_industries_sorted': sorted(list(all_industries)),
                'industry_frequency': dict(industry_frequency),
                'industries_by_role': {
                    'founder': sorted(list(industries_by_role['founder'])),
                    'developer': sorted(list(industries_by_role['developer'])),
                    'overlap': sorted(list(
                        industries_by_role['founder'].intersection(industries_by_role['developer'])
                    ))
                },
                'frequency_analysis': {
                    'most_common': industry_frequency.most_common(5),
                    'least_common': industry_frequency.most_common()[:-6:-1]
                }
            },
            'user_industry_mapping': user_industry_mapping
        }

        # Print analysis
        print("\n=== Industry Analysis Report ===")
        print(f"\nTotal Unique Industries: {results['metadata']['total_unique_industries']}")
        print(f"Total Users Analyzed: {results['metadata']['total_users_analyzed']}")

        print("\nAll Industries (Sorted):")
        for industry in results['industry_stats']['all_industries_sorted']:
            count = industry_frequency[industry]
            print(f"- {industry} ({count} users)")

        print("\nMost Common Industries:")
        for industry, count in results['industry_stats']['frequency_analysis']['most_common']:
            print(f"- {industry}: {count} users")

        print("\nLeast Common Industries:")
        for industry, count in results['industry_stats']['frequency_analysis']['least_common']:
            print(f"- {industry}: {count} users")

        print("\nFounder-Specific Industries:")
        founder_only = industries_by_role['founder'] - industries_by_role['developer']
        for industry in sorted(founder_only):
            print(f"- {industry}")

        print("\nDeveloper-Specific Industries:")
        dev_only = industries_by_role['developer'] - industries_by_role['founder']
        for industry in sorted(dev_only):
            print(f"- {industry}")

        # Save results to JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f'industry_analysis_{timestamp}.json'
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nFull analysis saved to {filename}")

        return results

    except Exception as e:
        print(f"Error extracting industries: {e}")
        return None

def extract_engineer_skills_from_firebase():
    """Extract and analyze unique skills from software engineers in Firebase"""
    db = initialize_firebase()
    if not db:
        return None

    try:
        # Get all users from the hackathonusers collection with role softwareEngineer
        users = db.collection('hackathonusers').where('role', '==', 'softwareEngineer').get()

        # Initialize set for unique skills
        unique_skills = set()

        # Process each user
        for user in users:
            user_data = user.to_dict()
            user_skills = user_data.get('skills', [])
            unique_skills.update(user_skills)

        # Convert to sorted list
        sorted_skills = sorted(list(unique_skills))

        # Prepare results
        results = {
            'metadata': {
                'total_unique_skills': len(unique_skills),
                'extraction_date': datetime.now().isoformat()
            },
            'skills': sorted_skills
        }

        # Print analysis
        print("\n=== Software Engineer Skills Analysis ===")
        print(f"\nTotal Unique Skills: {results['metadata']['total_unique_skills']}")
        print("\nAll Skills (Sorted):")
        for skill in sorted_skills:
            print(f"- {skill}")

        # Save results to JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f'engineer_skills_analysis_{timestamp}.json'
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nFull analysis saved to {filename}")

        return results

    except Exception as e:
        print(f"Error extracting skills: {e}")
        return None

if __name__ == "__main__":
    extract_engineer_skills_from_firebase()
