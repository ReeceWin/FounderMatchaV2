from flask import Flask, render_template, jsonify, request, url_for
import firebase_admin
from firebase_admin import credentials, firestore
from models.calculate_matches import EnhancedMatcher
import logging
import os
from functools import wraps
import time

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)


def initialize_firebase():
    """Initialize Firebase with retry logic"""
    max_attempts = 3
    attempt = 0

    while attempt < max_attempts:
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate('firebase-credentials.json')
                firebase_admin.initialize_app(cred)
            return firestore.client()
        except Exception as e:
            attempt += 1
            if attempt == max_attempts:
                logger.error(f"Failed to initialize Firebase after {max_attempts} attempts: {e}")
                raise
            logger.warning(f"Firebase initialization attempt {attempt} failed: {e}")
            time.sleep(2 ** attempt)  # Exponential backoff


def retry_on_firebase_error(f):
    """Decorator to retry Firebase operations"""

    @wraps(f)
    def wrapper(*args, **kwargs):
        max_attempts = 3
        attempt = 0
        last_error = None

        while attempt < max_attempts:
            try:
                return f(*args, **kwargs)
            except Exception as e:
                attempt += 1
                last_error = e
                if attempt == max_attempts:
                    logger.error(f"Operation failed after {max_attempts} attempts: {e}")
                    if 'get_developer_profile' in f.__name__:
                        return {
                            'id': 'default',
                            'name': 'Profile Temporarily Unavailable',
                            'role': 'Developer',
                            'skills': [],
                            'profileImageUrl': 'images/profiles/default-profile.png',
                            'personalityResults': {}
                        }
                    return None
                logger.warning(f"Operation attempt {attempt} failed: {e}")
                time.sleep(2 ** attempt)
        return None

    return wrapper


# Initialize Firebase with retry logic
try:
    db = initialize_firebase()
    matcher = EnhancedMatcher('firebase-credentials.json')
except Exception as e:
    logger.error(f"Fatal error initializing Firebase: {e}")
    db = None
    matcher = None


def get_local_image_path(profileImageUrl):
    """Convert database profileImageUrl to local static path or return default image"""
    logger.debug(f"Starting get_local_image_path with input: {profileImageUrl}")

    if not profileImageUrl:
        logger.debug("No profile URL provided, returning default")
        return '/static/images/profiles/default-profile.png'

    # Get the file system path by joining static folder with 'images' and the profileImageUrl
    fs_path = os.path.join(
        app.static_folder,
        'images',  # Add 'images' to the path
        profileImageUrl
    )

    # Clean up the path (replace backslashes with forward slashes)
    fs_path = fs_path.replace('\\', '/')

    # For the URL, we want /static/images/profiles/...
    url_path = f'/static/images/{profileImageUrl}'
    url_path = url_path.replace('//', '/')  # Clean up any double slashes

    logger.debug(f"Checking file system path: {fs_path}")
    logger.debug(f"URL path that will be returned: {url_path}")

    if os.path.isfile(fs_path):
        logger.debug(f"File exists at {fs_path}")
        return url_path
    else:
        logger.debug(f"File NOT found at {fs_path}")
        logger.debug(f"Attempted to find file at: {fs_path}")
        return '/static/images/profiles/default-profile.png'

@app.route('/')
def index():
    try:
        # Get initial profiles from database
        initial_founder = get_founder_profile(1)
        logger.debug(f"Initial founder data: {initial_founder}")

        initial_developer = get_developer_profile(1)
        logger.debug(f"Initial developer data: {initial_developer}")

        if not initial_founder or not initial_developer:
            logger.error("Could not fetch initial profiles")
            return "Error: Could not fetch profiles", 500

        initial_data = {
            'developer': initial_developer,
            'founder': initial_founder,
            'match_score': 0,
            'skills_score': 0,
            'personality_score': 0,
            'background_score': 0
        }

        return render_template('index.html', **initial_data)
    except Exception as e:
        logger.error(f"Error in index route: {e}", exc_info=True)
        return "An error occurred", 500


@retry_on_firebase_error
def get_founder_profile(founder_id):
    try:
        # Query the founders collection
        founders_ref = db.collection('hackathonusers')
        query = founders_ref.where('role', '==', 'founder / entrepreneur').limit(1)

        docs = list(query.stream())
        if docs:
            doc = docs[0]
            founder_data = doc.to_dict()
            logger.debug(f"Raw founder data from Firestore: {founder_data}")

            profile_image = founder_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profile_image)

            return {
                'id': doc.id,
                'name': founder_data.get('name', 'Unknown Founder'),
                'about': founder_data.get('about', ''),
                'longDescription': founder_data.get('longDescription', ''),
                'industries': founder_data.get('industries', []),
                'profileImageUrl': local_image_path
            }

        logger.warning("No founder found in database")
        return None
    except Exception as e:
        logger.error(f"Error fetching founder profile: {e}")
        return None


@retry_on_firebase_error
def get_developer_profile(developer_id):
    try:
        # Query all developers
        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)

        docs = list(query.stream())
        if docs:
            dev_doc = docs[0]
            dev_data = dev_doc.to_dict()

            logger.debug(f"Raw developer data from Firestore: {dev_data}")
            profileImageUrl = dev_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profileImageUrl)

            result = {
                'id': dev_doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'profileImageUrl': local_image_path,
                'personalityResults': dev_data.get('personalityResults', {})
            }

            logger.debug(f"Processed developer data: {result}")
            return result

        logger.warning("No developer found in database")
        return None
    except Exception as e:
        logger.error(f"Error fetching developer profile: {e}", exc_info=True)
        return None


@app.route('/api/match', methods=['POST'])
@retry_on_firebase_error
def match():
    try:
        founder_id = request.json.get('founder_id')
        developer_id = request.json.get('developer_id')

        founder = get_founder_profile(founder_id)
        developer = get_developer_profile(developer_id)

        if not founder or not developer:
            return jsonify({'error': 'Profile not found'}), 404

        match_results = matcher.calculate_match_score(founder, developer)
        return jsonify(match_results)
    except Exception as e:
        logger.error(f"Error in match calculation: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/developers', methods=['GET'])
@retry_on_firebase_error
def get_developers():
    try:
        current_id = request.args.get('current_id')
        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(10)

        if current_id:
            current_dev_ref = devs_ref.document(current_id)
            current_dev = current_dev_ref.get()
            if current_dev.exists:
                query = query.start_after(current_dev)

        developers = []
        for doc in query.stream():
            dev_data = doc.to_dict()
            logger.debug(f"Developer data from query: {dev_data}")

            profileImageUrl = dev_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profileImageUrl)

            developers.append({
                'id': doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'profileImageUrl': local_image_path
            })

        return jsonify(developers)
    except Exception as e:
        logger.error(f"Error fetching developers: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/profiles/next', methods=['GET'])
@retry_on_firebase_error
def next_profile():
    try:
        current_id = request.args.get('current_id')
        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)

        if current_id:
            current_dev_ref = devs_ref.document(current_id)
            current_dev = current_dev_ref.get()
            if current_dev.exists:
                query = query.start_after(current_dev)

        developers = list(query.stream())

        if not developers:
            # If no next developer, wrap around to the first one
            query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)
            developers = list(query.stream())

        if developers:
            dev_doc = developers[0]
            dev_data = dev_doc.to_dict()
            profileImageUrl = dev_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profileImageUrl)

            return jsonify({
                'id': dev_doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'profileImageUrl': local_image_path
            })

        return jsonify({'error': 'No developers found'}), 404
    except Exception as e:
        logger.error(f"Error fetching next profile: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profiles/previous', methods=['GET'])
@retry_on_firebase_error
def previous_profile():
    try:
        current_id = request.args.get('current_id')
        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)

        if current_id:
            current_dev_ref = devs_ref.document(current_id)
            current_dev = current_dev_ref.get()
            if current_dev.exists:
                query = query.order_by('__name__', direction=firestore.Query.DESCENDING).start_after(current_dev)

        developers = list(query.stream())

        if not developers:
            # If no previous developer, wrap around to the last one
            query = devs_ref.where('role', '==', 'softwareEngineer').order_by('__name__',
                                                                              direction=firestore.Query.DESCENDING).limit(
                1)
            developers = list(query.stream())

        if developers:
            dev_doc = developers[0]
            dev_data = dev_doc.to_dict()
            profileImageUrl = dev_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profileImageUrl)

            return jsonify({
                'id': dev_doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'profileImageUrl': local_image_path
            })

        return jsonify({'error': 'No developers found'}), 404
    except Exception as e:
        logger.error(f"Error fetching previous profile: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)